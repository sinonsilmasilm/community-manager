# Community Manager — AI-Powered Discord Bot

A production-oriented Discord bot: AI assistant (Arabic / Darija / English / French), slash
commands, configurable auto-moderation, welcome system, and an Arabic/English admin dashboard.

## ⚠️ Status of this build — read this first

This repository was generated and written in full (every file below is real, complete code —
not a stub), **but it has not been `npm install`-ed, type-checked, or run in this environment**,
because this sandbox has no network/package-registry access. Nothing was deployed to Vercel and
no Discord application was registered, because those require your own credentials, which I don't
have. Everything that didn't need your credentials was done; everything that does is listed under
**"What you need to do"** below, with exact steps.

Treat this as a complete, ready-to-install codebase rather than a verified-running deployment —
the very first thing to do is step 1 below (`npm install` + `npm run typecheck`) to catch anything
a dependency-version mismatch might surface.

## Architecture

Discord's **HTTP Interactions API** (what slash commands use) only delivers interaction events —
it never delivers regular messages or member-join events. Real-time moderation and welcome
messages need those, which means a persistent Gateway (WebSocket) connection. You cannot safely
hold that open inside an ordinary Vercel serverless function (it would reconnect/drop constantly
and multiply under scale-out). So this project is split into two independently deployable pieces:

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│  Vercel (serverless)    │        │  Gateway Worker (persistent)  │
│  api/interactions.ts    │        │  src/gateway/bot.ts           │
│   • /ask /help /rules   │        │   • welcome messages          │
│   • /serverinfo         │        │   • auto-role on join         │
│   • /userinfo           │        │   • real-time spam/link/word  │
│   • /announce /clear    │        │     moderation + mod alerts   │
│   • /mod /ai-status     │        │                                │
│  api/dashboard-api.ts   │        │  Run on Railway / Fly.io /    │
│  public/dashboard/*     │        │  a VPS / Termux+pm2            │
│   • admin config UI     │        │                                │
└─────────────────────────┘        └──────────────────────────────┘
              \_______________  shared  _______________/
                       KV store (config, warnings)
                (Upstash Redis REST — see .env.example)
```

Both pieces read/write the same config and warnings via `src/lib/storage.ts`, which uses an
Upstash Redis REST API if you configure one (`KV_REST_API_URL` / `KV_REST_API_TOKEN`), and
otherwise falls back to in-memory (fine for local testing, **not** for production — an in-memory
store resets on every serverless cold start and every gateway-worker restart).

## Tech stack

Node.js 18+, TypeScript, discord.js v14 (gateway worker only), raw Discord HTTP Interactions API
(no gateway in the serverless function), Vercel Functions, Vercel AI Gateway, Zod-ready structure,
Ed25519 signature verification via `tweetnacl`.

## Project layout

```
api/interactions.ts       Discord HTTP Interactions endpoint (Vercel function)
api/dashboard-api.ts      Admin dashboard REST API (Vercel function)
src/commands/             Slash command definitions + handlers
src/gateway/bot.ts        Persistent worker: welcome + real-time moderation
src/lib/                  Shared: AI client, config, storage, permissions,
                           moderation rules, Discord REST helpers, embeds
public/dashboard/         Static Arabic/English RTL admin dashboard (no build step)
scripts/register-commands.ts   Registers slash commands with Discord
tests/                    node:test unit tests (signature verify + moderation rules)
```

## 1. Local setup

```bash
git clone <this-repo>
cd community-manager
cp .env.example .env     # then fill in the values (see below)
npm install
npm run typecheck        # do this FIRST — catches any dependency drift
npm test
```

### Discord Developer Portal — required values

1. Go to <https://discord.com/developers/applications> → **New Application** → name it
   "Community Manager".
2. **General Information** tab → copy **Application ID** → `DISCORD_APPLICATION_ID`, and
   **Public Key** → `DISCORD_PUBLIC_KEY`.
3. **Bot** tab → **Reset Token** → copy it → `DISCORD_BOT_TOKEN` (treat this like a password —
   never commit it, never paste it in chat/screenshots).
   - Under **Privileged Gateway Intents**, enable **Server Members Intent** and
     **Message Content Intent** (the gateway worker needs both; the Vercel function does not).
4. **OAuth2 → URL Generator**: scopes `bot` + `applications.commands`; bot permissions at minimum
   `Send Messages`, `Embed Links`, `Manage Messages`, `Moderate Members`, `Read Message History`,
   `Manage Roles` (only if you'll use auto-role). Open the generated URL to invite the bot to your
   server.
5. Copy your test server's ID (right-click the server icon → Copy Server ID, with Developer Mode
   on in Discord settings) → `DISCORD_DEV_GUILD_ID` for fast local command testing.

### AI Gateway

Set `AI_GATEWAY_MODEL` (default `anthropic/claude-sonnet-4-6` — change to whatever model string
your Vercel AI Gateway project exposes). When deployed on Vercel, the gateway can authenticate
automatically via the platform's built-in OIDC token — `AI_GATEWAY_API_KEY` is only needed if
your gateway auth method requires an explicit key (check your Vercel AI Gateway project settings).

### Storage (strongly recommended)

Create a free Upstash Redis database (Vercel Marketplace → Upstash, or upstash.com directly),
copy its REST URL + token into `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Without this, dashboard
edits and warning history do **not** persist across restarts/cold starts.

### Admin dashboard

Set `ADMIN_DASHBOARD_TOKEN` to a long random string (e.g. `openssl rand -hex 32`). The dashboard
at `/dashboard` asks for your Guild ID + this token before showing any settings — it is not public.

## 2. Register slash commands

```bash
# instant, scoped to your dev server (requires DISCORD_DEV_GUILD_ID):
npm run register-commands:guild

# global, once you're ready for all servers (takes up to ~1h to propagate):
npm run register-commands
```

## 3. Deploy the Vercel side

```bash
npm install -g vercel     # if you don't have it
vercel login
vercel link
vercel env add DISCORD_APPLICATION_ID
vercel env add DISCORD_PUBLIC_KEY
vercel env add DISCORD_BOT_TOKEN
vercel env add AI_GATEWAY_MODEL
vercel env add ADMIN_DASHBOARD_TOKEN
vercel env add KV_REST_API_URL        # if using Upstash
vercel env add KV_REST_API_TOKEN
vercel deploy --prod
```

After deploying, Vercel prints your production URL, e.g. `https://community-manager-xyz.vercel.app`.
Your **Interactions Endpoint URL** (next step) is:

```
https://<your-deployment>.vercel.app/api/interactions
```

### Point Discord at your endpoint

In the Developer Portal → your app → **General Information** → **Interactions Endpoint URL** →
paste the URL above → **Save Changes**. Discord immediately sends a test PING to verify your
signature check — if `DISCORD_PUBLIC_KEY` is set correctly, this succeeds instantly; if it fails,
Discord shows an error right there and refuses to save (nothing silently broken).

### Verify it

```bash
curl -i -X POST https://<your-deployment>.vercel.app/api/interactions \
  -H "Content-Type: application/json" -d '{}'
# Expect: 401 Invalid request signature  → endpoint is live and correctly rejecting unsigned calls.
```
Then in Discord, type `/help` in your server — you should see the command appear and respond.
I have not been able to run this curl check or the live `/help` test myself (no network access
and no deployment credentials in this environment) — please run both and let me know if either
doesn't behave as described, since production readiness is fully a property of whether the actual
Discord ↔ Vercel round trip reproduces here.

## 4. Run the Gateway Worker (for welcome + real-time moderation)

Pick **one** of these:

**Railway / Fly.io / Render (recommended, free tier available on all three):**
Push this repo, set the same env vars as Vercel (minus the Vercel-specific ones), set the start
command to `npm run gateway`, deploy.

**A VPS with pm2:**
```bash
npm install -g pm2
pm2 start npm --name community-manager-gateway -- run gateway
pm2 save
```

**Termux on your Android phone** (works, but your phone needs to stay on/charged/online — fine
for testing, not ideal for 24/7 production):
```bash
pkg install nodejs git
git clone <this-repo> && cd community-manager
cp .env.example .env   # fill in values with a text editor, e.g. `nano .env`
npm install
npm install -g pm2
pm2 start npm --name cm-gateway -- run gateway
# keep Termux running in the background; consider `termux-wake-lock`
```

## 5. Admin dashboard

Visit `https://<your-deployment>.vercel.app/dashboard`, enter your Guild ID and the
`ADMIN_DASHBOARD_TOKEN` you set, and configure welcome/moderation settings. Changes save
immediately to the shared KV store and take effect on the next relevant event (no restart needed).

## Commands

| Command | Who | What |
|---|---|---|
| `/ask <question>` | everyone | AI assistant answer, auto-detects language |
| `/help` | everyone | Lists commands |
| `/rules` | everyone | Shows configured rules text |
| `/serverinfo` | everyone | Server stats |
| `/userinfo [user]` | everyone | Member info |
| `/announce <message> [channel]` | admin | Posts an announcement embed |
| `/clear <amount>` | Manage Messages | Bulk-deletes recent messages (2–100, <14 days old) |
| `/mod warn <user> <reason>` | Moderate Members | Logs a warning + alerts mod-log channel |
| `/mod warnings <user>` | Moderate Members | Lists a member's warning history |
| `/ai-status` | everyone | AI Gateway health check |

Every privileged command is restricted two ways: Discord's own `default_member_permissions` on
the command (hides it from unauthorized members) **and** a server-side permission re-check in the
handler (`src/lib/permissions.ts`) — the first is UX, the second is the actual security boundary.

## Moderation philosophy

Per the project brief: **the bot never auto-bans or auto-punishes**. `evaluateMessage()` in
`src/lib/moderation.ts` only ever returns *flags*; the gateway worker logs a warning record and
pings your configured mod-log channel so a human moderator decides what to do, using `/mod warn`
and Discord's native timeout/kick/ban tools. All thresholds (spam rate, repeat count, mention
count, link allow-list, banned words, warn-count-before-escalation) are configurable from the
dashboard, per the brief's requirement for "clear rules and configurable thresholds."

## Security notes

- Every interaction is Ed25519-signature-verified (`src/lib/discord-verify.ts`) before its body is
  trusted/parsed — unsigned or tampered requests get a `401` before any handler code runs.
- No secrets are logged; errors are caught and summarized, not dumped with full stack+env.
- `/clear` and `/mod` re-check permissions server-side regardless of what the Discord client UI
  already hid.
- The dashboard API requires a bearer token (`ADMIN_DASHBOARD_TOKEN`) on every request; it is not
  publicly readable or writable without it, and the token is never checked into source control.
- Destructive actions (`/clear`) require an explicit numeric amount from an authorized caller —
  there is no "clear all" and no automatic deletion anywhere in the codebase.

## Known limitations / what's intentionally left to you

- **Not yet installed/type-checked/tested in a real Node environment** — this sandbox had no
  network access, so `npm install`, `tsc`, and `node --test` have not actually been executed
  against these files. Run `npm run typecheck && npm test` as your very first step and report back
  any errors — TypeScript version drift between what I targeted and what npm resolves is the most
  likely source of small issues, if any.
- **Not deployed.** No Vercel project, no Discord application, and no gateway-worker host exist
  yet under this build — all of §3–§4 above are steps for you to run with your own accounts.
- **In-memory fallback is not production-safe.** Set up Upstash (or any Redis you like, by editing
  `src/lib/storage.ts`) before relying on persisted warnings/config.
- **`/rules` currently reuses `welcomeMessage`-style free text** rather than having its own
  dedicated field — trivial to split into its own `rulesText` config field in `src/types.ts` +
  dashboard if you want them independent.
- **Rate limiting for `/ask`** is per-serverless-instance in-memory (`src/lib/rateLimit.ts`), so it
  throttles bursts but isn't a strict global limit across concurrent instances; swap in the KV
  store there if you need a hard global cap.

## Testing report

Unit tests exist in `tests/` covering: Ed25519 signature acceptance/rejection
(`verify.test.ts`), and moderation rule evaluation — mention abuse, banned words, link
allow-listing, repeated-message detection (`moderation.test.ts`). These were written to the
`node:test` runner (`npm test`) but **could not be executed in this sandbox** (no package
installation). Please run `npm test` after `npm install` and treat a clean pass as the real
verification — I can't claim it passes without having run it.

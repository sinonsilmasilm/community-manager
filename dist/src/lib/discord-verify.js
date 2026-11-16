import nacl from "tweetnacl";
/**
 * Verifies the Ed25519 signature Discord attaches to every HTTP Interaction
 * request. This MUST pass before any interaction body is trusted/parsed —
 * it is what proves the request actually came from Discord and not from an
 * arbitrary caller hitting your public endpoint.
 *
 * See: https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
 */
export function verifyDiscordRequest(publicKey, signature, timestamp, rawBody) {
    if (!signature || !timestamp)
        return false;
    try {
        return nacl.sign.detached.verify(Buffer.from(timestamp + rawBody), Buffer.from(signature, "hex"), Buffer.from(publicKey, "hex"));
    }
    catch {
        return false;
    }
}

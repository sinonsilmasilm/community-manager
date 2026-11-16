// Groq API with fallback models - TypeScript fixed
const KEY: string = process.env.GROQ_API_KEY || "";
const URL_CHAT = "https://api.groq.com/openai/v1/chat/completions";

const MODELS: string[] = [
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama3-70b-8192",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "llama-3.1-8b-instant"
];

let CURRENT_MODEL: string = process.env.AI_MODEL || MODELS[0];

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }
export interface AiStatus { configured: boolean; model: string; reachable: boolean; error?: string; }

const SYSTEM_PERSONA: string = "Be concise and helpful. Answer in the user's language.";

const cache = new Map<string, { response: string; time: number }>();
const CACHE_TTL: number = 10 * 60 * 1000;

function getCacheKey(messages: ChatMessage[]): string {
  return messages.map(m => `${m.role}:${m.content}`).join("|");
}

export async function askAI(messages: ChatMessage[], maxTokens: number = 512, retries: number = 2): Promise<string> {
  if (!KEY) throw new Error("GROQ_API_KEY is not set");
  
  const cacheKey: string = getCacheKey(messages);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.response;
  }
  
  const body = JSON.stringify({
    model: CURRENT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PERSONA },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
  });
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const res = await fetch(URL_CHAT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${KEY}`,
        },
        body,
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        const err = new Error(`Groq ${res.status}: ${t.slice(0, 200)}`);
        
        if (res.status === 404 && attempt === 0) {
          const currentIndex = MODELS.indexOf(CURRENT_MODEL);
          if (currentIndex < MODELS.length - 1) {
            CURRENT_MODEL = MODELS[currentIndex + 1];
            console.log(`[AI] Switching to model: ${CURRENT_MODEL}`);
            lastError = err;
            continue;
          }
        }
        
        if (res.status === 429 || res.status >= 500) {
          lastError = err;
          if (attempt < retries) {
            const wait = 2000 * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
        }
        throw err;
      }
      
      const data: any = await res.json();
      const content: string = data?.choices?.[0]?.message?.content || "";
      
      if (!content) {
        throw new Error("No content in response");
      }
      
      cache.set(cacheKey, { response: content, time: Date.now() });
      return content;
    } catch (e: any) {
      lastError = e;
      if (attempt < retries && (e.name === "AbortError" || e.message.includes("429") || e.message.includes("5"))) {
        const wait = 2000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
  
  throw lastError || new Error("Unknown error");
}

export async function getAiStatus(): Promise<AiStatus> {
  const configured: boolean = Boolean(KEY);
  try {
    await askAI([{ role: "user", content: "Say ping" }], 200);
    return { configured, model: CURRENT_MODEL, reachable: true };
  } catch (e: any) {
    return { configured, model: CURRENT_MODEL, reachable: false, error: String(e?.message ?? e) };
  }
}

export const aiStatus = getAiStatus;
export const getAIStatus = getAiStatus;
export const getStatus = getAiStatus;
export const checkAiStatus = getAiStatus;
export default { askAI, getAiStatus };

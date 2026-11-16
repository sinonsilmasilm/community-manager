// Gemini with robust retry logic for slow connections
const MODEL = process.env.AI_MODEL || "gemini-3.8-flash";
const KEY = process.env.GEMINI_API_KEY || "";
const URL_CHAT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }
export interface AiStatus { configured: boolean; model: string; reachable: boolean; error?: string; }

const SYSTEM_PERSONA = "Be concise and helpful. Answer in the user's language.";

const cache = new Map<string, { response: string; time: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function getCacheKey(messages: ChatMessage[]): string {
  return messages.map(m => `${m.role}:${m.content}`).join("|");
}

export async function askAI(messages: ChatMessage[], maxTokens = 512, retries = 3): Promise<string> {
  if (!KEY) throw new Error("GEMINI_API_KEY is not set");
  
  const cacheKey = getCacheKey(messages);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.response;
  }
  
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  
  contents.unshift({
    role: "user" as const,
    parts: [{ text: SYSTEM_PERSONA }],
  });
  
  const body = JSON.stringify({
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3,
      topP: 0.8,
      topK: 20,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  });
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Timeout 30 ثانية (كافي للمغرب)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const res = await fetch(URL_CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        const err = new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
        
        if (res.status === 429 || res.status >= 500) {
          lastError = err;
          if (attempt < retries) {
            const wait = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
            console.log(`[AI] Retry ${attempt + 1}/${retries} after ${wait}ms`);
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
        }
        throw err;
      }
      
      const data: any = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) {
        const reason = data?.candidates?.[0]?.finishReason || "unknown";
        throw new Error(`No content (reason: ${reason})`);
      }
      
      cache.set(cacheKey, { response: content, time: Date.now() });
      return content;
    } catch (e: any) {
      lastError = e;
      // AbortError = timeout، نعيد المحاولة
      if (attempt < retries && (e.name === "AbortError" || e.message.includes("429") || e.message.includes("5"))) {
        const wait = 2000 * Math.pow(2, attempt);
        console.log(`[AI] Retry ${attempt + 1}/${retries} after ${wait}ms (${e.name || e.message.slice(0, 50)})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
  
  throw lastError || new Error("Unknown error");
}

export async function getAiStatus(): Promise<AiStatus> {
  const configured = Boolean(KEY);
  try {
    await askAI([{ role: "user", content: "Say ping" }], 200);
    return { configured, model: MODEL, reachable: true };
  } catch (e: any) {
    return { configured, model: MODEL, reachable: false, error: String(e?.message ?? e) };
  }
}

export const aiStatus = getAiStatus;
export const getAIStatus = getAiStatus;
export const getStatus = getAiStatus;
export const checkAiStatus = getAiStatus;
export default { askAI, getAiStatus };

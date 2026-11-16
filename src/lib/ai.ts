// Groq API - Dynamic model selection (2026)
const KEY: string = process.env.GROQ_API_KEY || "";
const URL_CHAT = "https://api.groq.com/openai/v1/chat/completions";
const URL_MODELS = "https://api.groq.com/openai/v1/models";

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }
export interface AiStatus { configured: boolean; model: string; reachable: boolean; error?: string; }

const SYSTEM_PERSONA = "Be concise and helpful. Answer in the user's language.";

let CURRENT_MODEL: string = "";
let modelsFetched = false;

// جلب النماذج المتاحة من Groq واختيار أول واحد صالح
async function selectWorkingModel(): Promise<string> {
  if (!KEY) throw new Error("GROQ_API_KEY is not set");
  
  if (modelsFetched && CURRENT_MODEL) return CURRENT_MODEL;
  
  try {
    const res = await fetch(URL_MODELS, {
      headers: { "Authorization": `Bearer ${KEY}` }
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch models: ${res.status}`);
    }
    
    const data = await res.json() as any;
    const availableModels: string[] = (data.data || [])
      .map((m: any) => m.id as string)
      .filter((id: string) => id.includes("llama") || id.includes("mixtral") || id.includes("gemma") || id.includes("deepseek") || id.includes("qwen"));
    
    console.log(`[AI] Found ${availableModels.length} available models`);
    
    if (availableModels.length === 0) {
      throw new Error("No suitable models available");
    }
    
    // اختر أول نموذج متاح
    CURRENT_MODEL = availableModels[0];
    console.log(`[AI] Selected model: ${CURRENT_MODEL}`);
    modelsFetched = true;
    
    return CURRENT_MODEL;
  } catch (e) {
    console.error("[AI] Error fetching models:", e);
    throw e;
  }
}

const cache = new Map<string, { response: string; time: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function getCacheKey(messages: ChatMessage[]): string {
  return messages.map(m => `${m.role}:${m.content}`).join("|");
}

export async function askAI(messages: ChatMessage[], maxTokens: number = 512, retries: number = 2): Promise<string> {
  if (!KEY) throw new Error("GROQ_API_KEY is not set");
  
  // جلب النموذج الصالح أولاً
  const model = await selectWorkingModel();
  
  const cacheKey = getCacheKey(messages);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.response;
  }
  
  const body = JSON.stringify({
    model: model,
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
      
      const data = await res.json() as any;
      const content: string = data?.choices?.[0]?.message?.content ?? "";
      
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
    modelsFetched = false; // إعادة جلب النماذج
    await askAI([{ role: "user", content: "Say ping" }], 200);
    return { configured, model: CURRENT_MODEL, reachable: true };
  } catch (e: any) {
    return { configured, model: CURRENT_MODEL || "unknown", reachable: false, error: String(e?.message ?? e) };
  }
}

export const aiStatus = getAiStatus;
export const getAIStatus = getAiStatus;
export const getStatus = getAiStatus;
export const checkAiStatus = getAiStatus;
export default { askAI, getAiStatus };

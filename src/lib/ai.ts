// Groq API - Production ready with dynamic model discovery
const KEY: string = process.env.GROQ_API_KEY || "";
const URL_CHAT = "https://api.groq.com/openai/v1/chat/completions";
const URL_MODELS = "https://api.groq.com/openai/v1/models";

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }
export interface AiStatus { configured: boolean; model: string; reachable: boolean; error?: string; }

const SYSTEM_PERSONA = "Be concise and helpful. Answer in the user's language.";

const cache = new Map<string, { response: string; time: number }>();
const CACHE_TTL = 10 * 60 * 1000;

// قائمة النماذج المفضلة (سيتم التحقق منها)
const PREFERRED_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama3-70b-8192",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "llama-3.1-8b-instant",
  "llama3-8b-8192"
];

let CURRENT_MODEL: string = "llama-3.3-70b-versatile";
let modelsLoaded = false;

// جلب النماذج المتاحة من Groq
async function loadAvailableModels(): Promise<void> {
  if (modelsLoaded || !KEY) return;
  try {
    const res = await fetch(URL_MODELS, {
      headers: { "Authorization": `Bearer ${KEY}` }
    });
    if (res.ok) {
      const data = await res.json() as any;
      const availableIds: string[] = (data.data || []).map((m: any) => m.id as string);
      // اختر أول نموذج متوفر من القائمة المفضلة
      for (const model of PREFERRED_MODELS) {
        if (availableIds.includes(model)) {
          CURRENT_MODEL = model;
          console.log(`[AI] Selected model: ${CURRENT_MODEL}`);
          break;
        }
      }
    }
    modelsLoaded = true;
  } catch (e) {
    console.log("[AI] Could not load models, using default");
    modelsLoaded = true;
  }
}

function getCacheKey(messages: ChatMessage[]): string {
  return messages.map(m => `${m.role}:${m.content}`).join("|");
}

export async function askAI(messages: ChatMessage[], maxTokens: number = 512, retries: number = 2): Promise<string> {
  if (!KEY) throw new Error("GROQ_API_KEY is not set");
  
  // تحميل النماذج المتاحة أول مرة
  await loadAvailableModels();
  
  const cacheKey = getCacheKey(messages);
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
        
        // إذا النموذج غير موجود، جرب النموذج التالي
        if (res.status === 404 && attempt === 0) {
          const currentIndex = PREFERRED_MODELS.indexOf(CURRENT_MODEL);
          if (currentIndex < PREFERRED_MODELS.length - 1) {
            CURRENT_MODEL = PREFERRED_MODELS[currentIndex + 1];
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

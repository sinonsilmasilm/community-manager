// Groq API - Smart model selection (excludes classification models)
const KEY: string = process.env.GROQ_API_KEY || "";
const URL_CHAT = "https://api.groq.com/openai/v1/chat/completions";
const URL_MODELS = "https://api.groq.com/openai/v1/models";

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }
export interface AiStatus { configured: boolean; model: string; reachable: boolean; error?: string; }

const SYSTEM_PERSONA = "Be concise and helpful. Answer in the user's language.";

let CURRENT_MODEL: string = "";
let modelsFetched = false;

// قائمة النماذج المفضلة بالترتيب (الأفضل أولاً)
const PREFERRED_MODELS = [
  "llama-3.3-70b-specdec",
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "deepseek-r1-distill-llama-70b",
  "qwen-qwq-32b",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "llama-3.1-8b-instant",
  "llama3-8b-8192",
  "llama3-70b-8192"
];

// كلمات مفتاحية لاستبعاد النماذج غير المناسبة للمحادثة
const EXCLUDED_KEYWORDS = [
  "guard",
  "prompt-guard",
  "classification",
  "embed",
  "whisper",
  "distil"
];

function isChatModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  // استبعاد النماذج غير المناسبة
  for (const keyword of EXCLUDED_KEYWORDS) {
    if (lower.includes(keyword)) return false;
  }
  return true;
}

// جلب النماذج المتاحة واختيار الأفضل
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
    const allModels: string[] = (data.data || []).map((m: any) => m.id as string);
    
    // فلترة: نحتفظ فقط بنماذج المحادثة
    const chatModels = allModels.filter(isChatModel);
    
    console.log(`[AI] Total models: ${allModels.length}, Chat models: ${chatModels.length}`);
    
    if (chatModels.length === 0) {
      throw new Error("No chat models available");
    }
    
    // ابحث عن أول نموذج مفضل متاح
    let selected: string | null = null;
    for (const preferred of PREFERRED_MODELS) {
      if (chatModels.includes(preferred)) {
        selected = preferred;
        break;
      }
    }
    
    // إلا ما لقينا والو من المفضلة، خذ أول نموذج محادثة متاح
    if (!selected) {
      selected = chatModels[0];
    }
    
    CURRENT_MODEL = selected;
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
        
        // إذا النموذج ما خدمش، امسح الـ cache وجرب مرة أخرى (غادي يختار نموذج آخر)
        if ((res.status === 400 || res.status === 404) && attempt < retries) {
          modelsFetched = false;
          CURRENT_MODEL = "";
          lastError = err;
          continue;
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
    modelsFetched = false;
    CURRENT_MODEL = "";
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

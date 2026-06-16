// ════════════════════════════════════════════════════════════════════════
//  مِنبَر — سلاسل المزوّدين على الخادم (المفاتيح سرّية في بيئة Cloudflare)
//  لا يصل أي مفتاح للمتصفح. تُقرأ من env التي تضبطها في لوحة Cloudflare.
// ════════════════════════════════════════════════════════════════════════

// env: كائن المتغيرات السرّية من Cloudflare (Settings → Environment variables)
export function transcribeChain(env) {
  const acct = env.CF_ACCOUNT_ID || "ACCOUNT_ID"
  return [
    { name: "Groq", endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
      model: "whisper-large-v3-turbo", key: env.GROQ_KEY },
    { name: "Cloudflare", endpoint: `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/v1/audio/transcriptions`,
      model: "@cf/openai/whisper-large-v3-turbo", key: env.CF_AI_TOKEN },
    { name: "Fireworks", endpoint: "https://api.fireworks.ai/inference/v1/audio/transcriptions",
      model: "whisper-v3-turbo", key: env.FIREWORKS_KEY },
    { name: "DeepInfra", endpoint: "https://api.deepinfra.com/v1/openai/audio/transcriptions",
      model: "openai/whisper-large-v3-turbo", key: env.DEEPINFRA_KEY },
    { name: "Together", endpoint: "https://api.together.xyz/v1/audio/transcriptions",
      model: "openai/whisper-large-v3", key: env.TOGETHER_KEY },
  ].filter(p => p.key && !p.endpoint.includes("ACCOUNT_ID"))
}

export function llmChain(env) {
  const acct = env.CF_ACCOUNT_ID || "ACCOUNT_ID"
  return [
    { name: "Cerebras", endpoint: "https://api.cerebras.ai/v1/chat/completions",
      model: "gpt-oss-120b", key: env.CEREBRAS_KEY },
    { name: "Groq", endpoint: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.3-70b-versatile", key: env.GROQ_KEY },
    { name: "NVIDIA", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
      model: "meta/llama-3.3-70b-instruct", key: env.NVIDIA_KEY },
    { name: "Mistral", endpoint: "https://api.mistral.ai/v1/chat/completions",
      model: "mistral-small-latest", key: env.MISTRAL_KEY },
    { name: "Cloudflare", endpoint: `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/v1/chat/completions`,
      model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", key: env.CF_AI_TOKEN },
    { name: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions",
      model: "meta-llama/llama-3.3-70b-instruct:free", key: env.OPENROUTER_KEY },
  ].filter(p => p.key && !p.endpoint.includes("ACCOUNT_ID"))
}

export const isRetryable = (s) => s === 429 || s === 401 || s === 403 || s >= 500 || s === 0
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

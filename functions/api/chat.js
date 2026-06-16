// POST /api/chat — وسيط الذكاء: chat/completions بالتناوب. المفاتيح سرّية في env.
import { llmChain, isRetryable, cors } from "./_chains.js"

export async function onRequestOptions() {
  return new Response(null, { headers: cors })
}

export async function onRequestPost({ request, env }) {
  const chain = llmChain(env)
  if (!chain.length) return json({ error: "لا يوجد مفتاح نموذج مضبوط على الخادم" }, 500)

  const body = await request.json()
  const { messages, json: wantJson = false, temperature = 0.3, max_tokens = 1400 } = body || {}
  if (!Array.isArray(messages)) return json({ error: "messages مطلوبة" }, 400)

  let lastErr = "no provider"
  for (const p of chain) {
    try {
      const payload = { model: p.model, messages, temperature, max_tokens }
      if (wantJson) payload.response_format = { type: "json_object" }
      let res = await fetch(p.endpoint, { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
        body: JSON.stringify(payload) })
      if (!res.ok && wantJson && (res.status === 400 || res.status === 422)) {
        // مزوّد لا يدعم json_object — أعد بدونه
        res = await fetch(p.endpoint, { method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
          body: JSON.stringify({ model: p.model, messages, temperature, max_tokens }) })
      }
      if (!res.ok) { lastErr = `${p.name}: ${res.status}`; if (isRetryable(res.status)) continue }
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content?.trim() || ""
      if (text) return json({ provider: p.name, text })
      lastErr = `${p.name}: empty`
    } catch (e) { lastErr = `${p.name}: ${e.message}` }
  }
  return json({ error: "فشل الذكاء من كل المزوّدين — " + lastErr }, 502)
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status,
    headers: { "Content-Type": "application/json", ...cors } })
}

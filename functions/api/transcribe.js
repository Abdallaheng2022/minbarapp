// POST /api/transcribe — وسيط التفريغ: يستقبل الصوت، يجرّب المزوّدين بالتناوب،
// ويرجّع التفريغ. المفاتيح سرّية في env ولا تصل للمتصفح.
import { transcribeChain, isRetryable, cors } from "./_chains.js"

export async function onRequestOptions() {
  return new Response(null, { headers: cors })
}

export async function onRequestPost({ request, env }) {
  const chain = transcribeChain(env)
  if (!chain.length) return json({ error: "لا يوجد مفتاح تفريغ مضبوط على الخادم" }, 500)

  const form = await request.formData()
  const file = form.get("file")
  const language = form.get("language") || "ar"
  if (!file) return json({ error: "لا يوجد ملف صوتي" }, 400)
  const buf = await file.arrayBuffer()

  let lastErr = "no provider"
  for (const p of chain) {
    try {
      const fd = new FormData()
      fd.append("file", new Blob([buf], { type: file.type || "audio/webm" }), "audio.webm")
      fd.append("model", p.model)
      fd.append("language", language)
      fd.append("response_format", "verbose_json")
      fd.append("timestamp_granularities[]", "word")
      const res = await fetch(p.endpoint, { method: "POST",
        headers: { Authorization: `Bearer ${p.key}` }, body: fd })
      if (!res.ok) { lastErr = `${p.name}: ${res.status}`; if (isRetryable(res.status)) continue }
      const data = await res.json()
      return json({ provider: p.name, data })   // نرجّع الخام، والمتصفح يستخرج الكلمات
    } catch (e) { lastErr = `${p.name}: ${e.message}` }
  }
  return json({ error: "فشل التفريغ من كل المزوّدين — " + lastErr }, 502)
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status,
    headers: { "Content-Type": "application/json", ...cors } })
}

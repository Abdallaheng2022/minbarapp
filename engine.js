// ════════════════════════════════════════════════════════════════════════
//  مِنبَر — محرّك الاتصال (نسخة آمنة)  🔒
//  ينادي الوسيط على Cloudflare (/api/...) لا المزوّدين مباشرة،
//  فتبقى المفاتيح سرّية على الخادم ولا تصل للمتصفح أبدًا.
// ════════════════════════════════════════════════════════════════════════

// ── التفريغ: يرسل الصوت للوسيط، والوسيط يجرّب ٥ مزوّدين بالتناوب ──
export async function transcribeAudio(audioBlob, language = "ar", onProvider = () => {}) {
  const fd = new FormData()
  fd.append("file", audioBlob, "audio.webm")
  fd.append("language", language)
  const res = await fetch("/api/transcribe", { method: "POST", body: fd })
  const out = await res.json()
  if (!res.ok || out.error) throw new Error(out.error || ("transcribe " + res.status))
  onProvider(out.provider)
  const words = extractWords(out.data, language)
  if (!words.length) throw new Error("التفريغ رجع فارغًا")
  return { words, provider: out.provider }
}

function extractWords(data, language) {
  const FILLERS = {
    ar: new Set(["يعني","آآ","اه","اها","امم","ايه","إيه","همم","اممم","آه","ها"]),
    en: new Set(["um","uh","erm","hmm","uhh","umm","ahh","mmm"]),
    tr: new Set(["ee","eee","ışey","ııh","hmm"]),
  }
  const fill = FILLERS[language] || new Set()
  const out = []; let gi = 0
  const push = (text, start, end) => {
    text = (text || "").trim(); if (!text) return
    const clean = text.replace(/[،.؟!…,.?!]/g, "").trim().toLowerCase()
    out.push({ id: gi++, text, start: +(+start).toFixed(3), end: +(+end).toFixed(3),
      kind: fill.has(clean) ? "filler" : "speech" })
  }
  if (Array.isArray(data.words) && data.words.length) {
    data.words.forEach(w => push(w.word ?? w.text, w.start, w.end)); return out
  }
  if (Array.isArray(data.segments)) {
    data.segments.forEach(s => {
      if (Array.isArray(s.words) && s.words.length) s.words.forEach(w => push(w.word ?? w.text, w.start, w.end))
      else push(s.text, s.start, s.end)
    })
    if (out.length) return out
  }
  if (data.text) {
    const toks = data.text.split(/\s+/).filter(Boolean)
    const dur = data.duration || toks.length * 0.4
    const step = dur / Math.max(1, toks.length)
    toks.forEach((t, i) => push(t, i * step, (i + 1) * step))
  }
  return out
}

// ── الذكاء: ينادي وسيط /api/chat (يجرّب ٦ مزوّدين بالتناوب) ──
export async function chat(messages, { json = false, temperature = 0.3, max_tokens = 1400 } = {}, onProvider = () => {}) {
  const res = await fetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, json, temperature, max_tokens }),
  })
  const out = await res.json()
  if (!res.ok || out.error) throw new Error(out.error || ("chat " + res.status))
  onProvider(out.provider)
  return { text: out.text || "", provider: out.provider }
}

export function parseLoose(txt) {
  if (!txt) return null
  let t = txt.trim().replace(/^```json?/i, "").replace(/```$/, "").trim()
  const a = t.indexOf("{"), b = t.lastIndexOf("}")
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1)
  try { return JSON.parse(t) } catch { return null }
}

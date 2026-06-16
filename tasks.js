// ════════════════════════════════════════════════════════════════════════
//  مِنبَر — مهام الذكاء في المتصفح  🧠
//  التصحيح اللغوي + القَصّ الذكي — تعمل عبر محرّك التناوب (engine.js).
// ════════════════════════════════════════════════════════════════════════
import { chat, parseLoose } from "./engine.js"

const LANG_NAMES = { ar:"Arabic", en:"English", tr:"Turkish", hi:"Hindi", es:"Spanish", de:"German", fr:"French", ru:"Russian" }

// ── محاذاة بسيطة (LCS) للحفاظ على توقيت الكلمات بعد التصحيح ──
function realign(origWords, correctedText) {
  const corr = correctedText.split(/\s+/).filter(Boolean)
  const orig = origWords.map(w => w.text)
  // LCS عبر مصفوفة
  const n = orig.length, m = corr.length
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = orig[i] === corr[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1])
  const out = []; let i = 0, j = 0
  const carry = []
  while (i < n && j < m) {
    if (orig[i] === corr[j]) {
      if (carry.length) { // كلمات مصحّحة قبل تطابق: ألصقها بتوقيت الكلمة الحالية
        const t = origWords[i]
        carry.forEach(ct => out.push({ text: ct, start: t.start, end: t.start, edited: true, orig: "" }))
        carry.length = 0
      }
      out.push({ ...origWords[i], edited: false }); i++; j++
    } else if (dp[i+1][j] >= dp[i][j+1]) {
      // كلمة أصلية حُذفت/تغيّرت — خذ توقيتها وضع البديل لو وُجد
      const t = origWords[i]
      if (j < m && carry.length === 0) { out.push({ text: corr[j], start: t.start, end: t.end, edited: true, orig: t.text }); j++ }
      else out.push({ ...origWords[i], edited: false })
      i++
    } else { carry.push(corr[j]); j++ }
  }
  while (i < n) { out.push({ ...origWords[i], edited: false }); i++ }
  const last = out[out.length - 1] || { end: 0 }
  while (j < m) { out.push({ text: corr[j], start: last.end, end: last.end, edited: true, orig: "" }); j++ }
  return out.map((w, k) => ({ ...w, id: k, kind: w.kind || "speech" }))
}

export async function correctText(words, language = "ar", onProvider = () => {}) {
  const name = LANG_NAMES[language] || "the same"
  const sys = `You are a professional ${name} proofreader. Fix ONLY speech-to-text transcription errors (misheard words, homophones, spelling, wrong splits/merges, punctuation). Do NOT rephrase, reorder, shorten, expand, translate, or change style or dialect. Keep sacred/quoted religious wording unless it is a clear transcription error. Return ONLY the corrected text — no preamble.`
  const text = words.map(w => w.text).join(" ")
  const { text: fixed, provider } = await chat(
    [{ role: "system", content: sys }, { role: "user", content: text }],
    { temperature: 0, max_tokens: 4000 }, onProvider)
  const aligned = realign(words, fixed.trim())
  const flags = aligned.filter(w => w.edited).map(w => ({ id: w.id, why: `📝 ${w.orig || "—"} ← ${w.text}` }))
  return { words: aligned, flags, provider }
}

// ── القَصّ الذكي: وصف نصّي → نطاقات كلمات للحذف → نطاقات زمنية للإبقاء ──
const SMART_SYS = `You are a precise video-editing assistant for spoken-word lectures.
You receive a numbered transcript (id:word) and an Arabic instruction describing what to CUT or KEEP.
Return ONLY strict JSON: {"remove": [[start_id, end_id], ...], "reason": "short arabic"}.
Rules: ids must exist; ranges non-overlapping and ordered; match meaning not exact words ("المقدمة"=intro/greeting, "الكلام الجانبي"=asides, "الحشو"=fillers); never invent ids; keep religiously sensitive content unless explicitly told to cut.`

export async function smartCut(words, instruction, onProvider = () => {}) {
  const id2 = new Map(words.map(w => [w.id, w]))
  // قسّم لو طويل جدًا
  const chunks = []; let cur = [], size = 0
  for (const w of words) { const tok = `${w.id}:${w.text} `; if (size + tok.length > 11000 && cur.length) { chunks.push(cur); cur = []; size = 0 } cur.push(w); size += tok.length }
  if (cur.length) chunks.push(cur)

  let allRemove = [], reasons = [], provider = ""
  for (const ch of chunks) {
    const numbered = ch.map(w => `${w.id}:${w.text}`).join(" ")
    const { text, provider: pv } = await chat(
      [{ role: "system", content: SMART_SYS },
       { role: "user", content: `INSTRUCTION: ${instruction}\n\nTRANSCRIPT:\n${numbered}\n\nReturn the JSON now.` }],
      { json: true, temperature: 0, max_tokens: 1200 }, onProvider)
    provider = pv
    const o = parseLoose(text)
    if (o && Array.isArray(o.remove))
      o.remove.forEach(p => { if (Array.isArray(p) && p.length === 2) allRemove.push([+p[0], +p[1]]) })
    if (o && o.reason) reasons.push(o.reason)
  }
  // تنظيف ودمج
  const valid = allRemove.map(([s, e]) => s > e ? [e, s] : [s, e]).filter(([s, e]) => id2.has(s) && id2.has(e)).sort((a, b) => a[0] - b[0])
  const merged = []
  for (const [s, e] of valid) {
    if (merged.length && s <= merged[merged.length - 1][1] + 1) merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e)
    else merged.push([s, e])
  }
  const removed = new Set()
  merged.forEach(([s, e]) => { for (let i = s; i <= e; i++) removed.add(i) })
  return { removeIds: merged, removed, reason: reasons.join(" · ").slice(0, 300), provider }
}

// كلمات مُبقاة → نطاقات زمنية متّصلة (للقصّ بـ ffmpeg.wasm)
export function keptSegments(words, removedSet) {
  const segs = []; let cur = null
  for (const w of words) {
    if (removedSet.has(w.id) || w.removed) { if (cur) { segs.push(cur); cur = null } continue }
    if (!cur) cur = [w.start, w.end]; else cur[1] = w.end
  }
  if (cur) segs.push(cur)
  return segs.filter(([s, e]) => e - s > 0.04).map(([s, e]) => [+s.toFixed(3), +e.toFixed(3)])
}

// ════════════════════════════════════════════════════════════════════════
//  مِنبَر — التطبيق (نسخة Cloudflare: كل شيء في المتصفح + Supabase + APIs)  🕌
// ════════════════════════════════════════════════════════════════════════
import { CONFIG } from "./config.js"
import { transcribeAudio } from "./engine.js"
import { correctText, smartCut, keptSegments } from "./tasks.js"
import { extractAudio, cutAndConcat } from "./ffmpeg-cut.js"
import { sb, cloudOn, auth, projects, uploadMedia } from "./db.js"

const $ = (id) => document.getElementById(id)
const state = { me: null, file: null, fileUrl: null, words: [], smartSugg: null }

function toast(msg) { const t = $("toast"); t.textContent = msg; t.style.display = "block"; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 3000) }
function setStatus(s) { $("status").textContent = s }

// ---------- auth ----------
async function refreshMe() {
  if (!cloudOn()) { $("authBox").innerHTML = `<span class="muted">⚠️ اضبط Supabase في cloud/config.js</span>`; return }
  const { data: { user } } = await sb().auth.getUser()
  if (user) { state.me = await auth.profile(user.id); renderAuthed() }
  else renderGuest()
}
function renderGuest() {
  $("authBox").innerHTML = `
    <input id="email" placeholder="البريد" class="inp"><input id="pass" type="password" placeholder="كلمة المرور" class="inp">
    <button id="loginBtn" class="btn">دخول</button><button id="signupBtn" class="btn gold">حساب جديد</button>`
  $("loginBtn").onclick = () => doAuth("in"); $("signupBtn").onclick = () => doAuth("up")
}
function renderAuthed() {
  const prem = auth.isPremium(state.me)
  $("authBox").innerHTML = `<span class="muted">${state.me.email} ${prem ? "⭐" : ""}</span>
    ${prem ? "" : '<button id="upBtn" class="btn gold">⭐ اشترك</button>'}
    <button id="outBtn" class="btn">خروج</button>`
  $("outBtn").onclick = async () => { await auth.signOut(); state.me = null; renderGuest() }
  const up = $("upBtn"); if (up) up.onclick = () => { if (CONFIG.CHECKOUT_URL) location.href = CONFIG.CHECKOUT_URL; else toast("تواصل مع الأدمن للتفعيل") }
}
async function doAuth(mode) {
  const email = $("email").value.trim(), pass = $("pass").value
  if (!email || !pass) return
  try { mode === "in" ? await auth.signIn(email, pass) : await auth.signUp(email, pass); await refreshMe(); toast("أهلًا بك") }
  catch (e) { toast("خطأ: " + e.message) }
}

// ---------- upload + transcribe ----------
$("pickBtn").onclick = () => $("fileInput").click()
$("fileInput").onchange = (e) => { const f = e.target.files[0]; if (f) loadFile(f) }

async function loadFile(file) {
  state.file = file
  state.fileUrl = URL.createObjectURL(file)
  $("video").src = state.fileUrl
  $("editor").style.display = "block"
  const premium = auth.isPremium(state.me)
  const maxSec = premium ? null : CONFIG.FREE_SECONDS
  try {
    setStatus("🎬 استخراج الصوت…")
    const audio = await extractAudio(file, maxSec)
    setStatus("✍️ التفريغ…")
    const { words, provider } = await transcribeAudio(audio, $("lang").value, (p) => setStatus(`✍️ التفريغ عبر ${p}…`))
    state.words = words.map(w => ({ ...w, removed: false }))
    renderDoc(); recompute()
    setStatus(`✓ تم التفريغ عبر ${provider} (${words.length} كلمة)` + (maxSec ? " — أول ٥ دقائق (مجاني)" : ""))
    if (cloudOn() && state.me) saveProject(provider).catch(() => {})
  } catch (e) { setStatus("✗ " + e.message); toast(e.message) }
}

async function saveProject(provider) {
  let media_url = null
  try { media_url = await uploadMedia(state.file, state.me.id) } catch {}
  await projects.create({ owner_id: state.me.id, title: state.file.name, filename: state.file.name,
    media_url, language: $("lang").value, status: "done", transcript: state.words })
}

// ---------- document render ----------
function renderDoc() {
  const doc = $("doc"); doc.innerHTML = ""
  state.words.forEach(w => {
    const span = document.createElement("span")
    span.className = "w"; span.dataset.id = w.id; span.textContent = w.text + " "
    span.onclick = () => { w.removed = !w.removed; paint(); recompute() }
    doc.appendChild(span)
  })
  paint()
}
function paint() {
  document.querySelectorAll("#doc .w").forEach(el => {
    const w = state.words[+el.dataset.id]; el.className = "w"
    if (w.removed) el.classList.add("rem")
    if (w._smartCut) el.classList.add("smartcut")
    if (w.kind === "filler") el.classList.add("filler")
    if (w.edited) el.classList.add("edited")
  })
}
function recompute() {
  const kept = state.words.filter(w => !w.removed)
  const dur = kept.reduce((a, w) => a + Math.max(0, w.end - w.start), 0)
  $("stats").textContent = `${kept.length} كلمة مُبقاة · ${state.words.filter(w => w.removed).length} محذوفة · ~${dur.toFixed(0)} ثانية`
}

// ---------- tools ----------
$("fillerBtn").onclick = () => { state.words.forEach(w => { if (w.kind === "filler") w.removed = true }); paint(); recompute() }

$("fixBtn").onclick = async () => {
  if (!state.words.length) return
  setStatus("📝 التصحيح اللغوي…")
  try {
    const { words, flags, provider } = await correctText(state.words.filter(w => true), $("lang").value, (p) => setStatus(`📝 التصحيح عبر ${p}…`))
    // احتفظ بحالة removed قدر الإمكان عبر id
    const remMap = new Map(state.words.map(w => [w.id, w.removed]))
    state.words = words.map(w => ({ ...w, removed: remMap.get(w.id) || false }))
    renderDoc(); recompute(); setStatus(`✓ صُحّح عبر ${provider} (${flags.length} تعديل)`)
  } catch (e) { setStatus("✗ " + e.message); toast(e.message) }
}

$("smartBtn").onclick = async () => {
  const instruction = $("smartInput").value.trim()
  if (!instruction) { $("smartInput").focus(); return }
  setStatus("✂️ تحليل القَصّ…")
  try {
    const { removed, reason, provider } = await smartCut(state.words, instruction, (p) => setStatus(`✂️ القص عبر ${p}…`))
    state.smartSugg = removed
    state.words.forEach(w => { w._smartCut = removed.has(w.id) })
    paint()
    if (!removed.size) { setStatus("لم يُحدّد النموذج مقطعًا مطابقًا."); $("smartApply").style.display = "none" }
    else { $("smartApply").style.display = ""; $("smartApply").textContent = `✓ طبّق الحذف (${removed.size})`; setStatus(`✂️ اقتراح عبر ${provider}: ${reason || ""}`) }
  } catch (e) { setStatus("✗ " + e.message); toast(e.message) }
}
$("smartApply").onclick = () => {
  if (!state.smartSugg) return
  state.words.forEach(w => { if (state.smartSugg.has(w.id)) { w.removed = true; w._smartCut = false } })
  state.smartSugg = null; $("smartApply").style.display = "none"; paint(); recompute()
}

// ---------- export (ffmpeg.wasm في المتصفح) ----------
$("exportBtn").onclick = async () => {
  const segs = keptSegments(state.words, new Set())
  if (!segs.length) return toast("لا يوجد ما يُصدّر")
  setStatus("🎬 قصّ الفيديو في متصفحك… (قد يأخذ وقتًا حسب الطول)")
  try {
    const blob = await cutAndConcat(state.file, segs, (m) => { if (m.includes("frame")) setStatus("🎬 " + m.slice(0, 60)) })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "minbar-edited.mp4"; a.click()
    setStatus("✓ تم التصدير وتنزيل الفيديو")
  } catch (e) { setStatus("✗ " + e.message); toast(e.message) }
}

// ---------- downloads (نص/SRT/JSON) ----------
$("dlTxt").onclick = () => download("transcript.txt", state.words.filter(w => !w.removed).map(w => w.text).join(" "))
$("dlJson").onclick = () => download("transcript.json", JSON.stringify(state.words, null, 2))
function download(name, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click()
}

refreshMe()

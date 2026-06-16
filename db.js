// ════════════════════════════════════════════════════════════════════════
//  مِنبَر — Supabase في المتصفح  🗄️
//  الحسابات + المشاريع + تخزين الفيديو. (يُحمّل supabase-js من CDN في index.html)
// ════════════════════════════════════════════════════════════════════════
import { CONFIG } from "./config.js"

let _sb = null
export function sb() {
  if (_sb) return _sb
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) return null
  _sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  return _sb
}
export const cloudOn = () => !!sb()

export const auth = {
  async signUp(email, password) {
    const { data, error } = await sb().auth.signUp({ email, password })
    if (error) throw error
    return data.user
  },
  async signIn(email, password) {
    const { data, error } = await sb().auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.user
  },
  async signOut() { await sb().auth.signOut() },
  async profile(uid) {
    const { data } = await sb().from("profiles").select("*").eq("id", uid).single()
    return data
  },
  isPremium(p) {
    if (!p) return false
    if (p.role === "admin") return true
    return p.premium_until && new Date(p.premium_until) > new Date()
  },
}

export const projects = {
  async create(row) {
    const { data, error } = await sb().from("projects").insert(row).select().single()
    if (error) throw error
    return data
  },
  async update(id, patch) {
    const { error } = await sb().from("projects").update(patch).eq("id", id)
    if (error) throw error
  },
  async mine() {
    const { data } = await sb().from("projects").select("*").order("created_at", { ascending: false })
    return data || []
  },
  async get(id) {
    const { data } = await sb().from("projects").select("*").eq("id", id).single()
    return data
  },
}

// تخزين الفيديو في bucket عام اسمه media
export async function uploadMedia(file, uid) {
  const path = `${uid}/${Date.now()}-${file.name}`.replace(/\s+/g, "_")
  const { error } = await sb().storage.from("media").upload(path, file, { upsert: true })
  if (error) throw error
  return sb().storage.from("media").getPublicUrl(path).data.publicUrl
}

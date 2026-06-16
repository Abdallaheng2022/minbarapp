// ════════════════════════════════════════════════════════════════════════
//  مِنبَر — إعدادات المتصفح (الآمنة فقط)  ⚙️
//  ► مفاتيح المزوّدين (Groq/Cerebras…) لم تعد هنا — صارت سرّية على خادم
//    Cloudflare (متغيرات بيئة)، فلا يصل إليها أحد من المتصفح. راجع DEPLOY.md.
//  ► هنا فقط إعدادات آمنة للمتصفح بطبيعتها.
// ════════════════════════════════════════════════════════════════════════

export const CONFIG = {
  // Supabase: المفتاح anon آمن للمتصفح (محميّ بـ RLS) — هذا تصميمه الطبيعي.
  // من: supabase.com → مشروعك → Settings → API
  SUPABASE_URL: "https://vesjjpazcmrxjcqrlpjg.supabase.co",        // مثال: https://abcd.supabase.co
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlc2pqcGF6Y21yeGpjcXJscGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MzE0MjksImV4cCI6MjA5NzEwNzQyOX0.IUPyszfmoadQQAfl1M41ptcvXp2zymMQVcbLXnEXPBg",   // anon public key (وليس service_role أبدًا)

  // إعدادات عامة
  FREE_SECONDS: 300,       // النسخة المجانية تفرّغ أول ٥ دقائق
  CHECKOUT_URL: "",        // رابط الدفع للاشتراك (اتركه فارغًا للتفعيل اليدوي)
}

export const cloudReady = () => !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY)

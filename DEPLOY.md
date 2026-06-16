# مِنبَر (نسخة السحابة الآمنة) — دليل الرفع ☁️🔒

نسخة تعمل **بالكامل مجانًا**، و**مفاتيحك سرّية تمامًا** (لا تصل لمتصفح أي زائر):
الواجهة على Cloudflare Pages، والتفريغ/الذكاء يمرّان عبر **وسيط** على Cloudflare
يحمل المفاتيح في بيئته السرّية، وقَصّ الفيديو في متصفح المستخدم (ffmpeg.wasm)،
والحسابات/البيانات على Supabase. **لا خادم تديره، لا GPU، لا تكلفة.**

---

## لماذا هذه النسخة آمنة؟
أي مفتاح في ملف JavaScript عادي يصل لمتصفح الزائر ويمكن سرقته (F12). هنا الحل:
```
المتصفح → /api/transcribe و /api/chat (وسيط على Cloudflare) → [المفاتيح هنا فقط] → Groq/Cerebras…
```
المفاتيح تُحفظ كـ **Environment Variables سرّية** في Cloudflare ولا تُرسل للمتصفح إطلاقًا.

---

## الخطوة ١: جهّز Supabase
1. أنشئ مشروعًا على `supabase.com`.
2. SQL Editor → الصق `schema_supabase.sql` كاملًا → Run (آمن للإعادة).
3. تأكّد أن bucket باسم `media` موجود وPublic (يُنشئه السكربت).
4. انسخ `Project URL` و`anon key` (Settings → API) وضعهما في `config.js`.
   (anon key آمن للمتصفح بحكم تصميمه + RLS. **لا تضع service_role أبدًا.**)
5. بعد تسجيل حسابك من التطبيق، اجعله أدمن:
   `update profiles set role='admin' where email='بريدك';`

---

## الخطوة ٢: ارفع على Cloudflare Pages
1. `dash.cloudflare.com` → Workers & Pages → Create → Pages.
2. اربط مستودع Git فيه محتويات `cloud/`، أو ارفعها يدويًا (Upload assets).
   **مهم:** مجلد `functions/` يجب أن يكون في جذر النشر بجانب `index.html` —
   Cloudflare يحوّله تلقائيًا إلى مسارات `/api/...`.
3. Deploy.

---

## الخطوة ٣: ضع المفاتيح كأسرار في Cloudflare (هنا الأمان)
في مشروع Pages → **Settings → Environment variables** → أضف ما تريد (الفارغ يُتخطّى):

| المتغيّر | لِمن | من أين |
|---|---|---|
| `GROQ_KEY` | تفريغ + ذكاء | console.groq.com |
| `CEREBRAS_KEY` | ذكاء (الأساسي) | cloud.cerebras.ai |
| `NVIDIA_KEY` | ذكاء | build.nvidia.com |
| `MISTRAL_KEY` | ذكاء | console.mistral.ai |
| `OPENROUTER_KEY` | ذكاء | openrouter.ai |
| `FIREWORKS_KEY` | تفريغ | fireworks.ai |
| `DEEPINFRA_KEY` | تفريغ | deepinfra.com |
| `TOGETHER_KEY` | تفريغ | together.ai |
| `CF_ACCOUNT_ID` + `CF_AI_TOKEN` | تفريغ + ذكاء | dash.cloudflare.com → AI → Workers AI |

**أقل ما يلزم للبدء:** `GROQ_KEY` (تفريغ) + `CEREBRAS_KEY` (ذكاء). والبقية احتياط بالتناوب.
بعد إضافة المتغيرات، اضغط **Retry deployment** (أو ادفع تحديثًا) ليلتقطها الوسيط.

---

## كيف يعمل التناوب؟ (الشحنات المجانية المتبادلة)
- **التفريغ:** Groq → Cloudflare → Fireworks → DeepInfra → Together (٥ مزوّدين).
- **الذكاء:** Cerebras → Groq → NVIDIA → Mistral → Cloudflare → OpenRouter (٦ مزوّدين).

الوسيط يجرّب الأول؛ فإذا نفد رصيده (429) أو تعطّل، **يسدّ التالي تلقائيًا** حتى ينجح واحد.
المتصفح يعرف فقط اسم المزوّد الذي ردّ (للعرض)، ولا يرى أي مفتاح.

---

## ملاحظات صدق
- **القَصّ في المتصفح** ممتاز للقصير/المتوسط؛ الملفات الطويلة جدًا أبطأ على الأجهزة الضعيفة.
- **حدود التفريغ المجانية يومية** لكل مزوّد؛ التناوب يخفّفها كثيرًا.
- **توقيت الكلمات** أدق مع Groq. للخصوصية المحلية الكاملة استخدم النسخة الأصلية (Whisper/Ollama).

📋 لأفضل النماذج المجانية لكل مهمة، راجع `MODELS.md`.

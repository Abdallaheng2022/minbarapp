// ════════════════════════════════════════════════════════════════════════
//  مِنبَر — قَصّ الفيديو في المتصفح عبر ffmpeg.wasm  ✂️🎬
//  لا حاجة لخادم: كل القصّ والدمج يتم داخل جهاز المستخدم.
// ════════════════════════════════════════════════════════════════════════
let _ff = null
let _loading = null

async function getFF(onLog = () => {}) {
  if (_ff) return _ff
  if (_loading) return _loading
  _loading = (async () => {
    // FFmpeg و util مُحمّلان من CDN في index.html (window.FFmpegWASM / window.FFmpegUtil)
    const { FFmpeg } = window.FFmpegWASM
    const ff = new FFmpeg()
    ff.on("log", ({ message }) => onLog(message))
    const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd"
    await ff.load({
      coreURL: `${base}/ffmpeg-core.js`,
      wasmURL: `${base}/ffmpeg-core.wasm`,
    })
    _ff = ff
    return ff
  })()
  return _loading
}

// استخراج صوت 16kHz أحادي للتفريغ (نرسله للـ API)
export async function extractAudio(file, maxSeconds = null, onProgress = () => {}) {
  const ff = await getFF()
  const { fetchFile } = window.FFmpegUtil
  const inName = "in_" + file.name.replace(/[^\w.]/g, "_")
  await ff.writeFile(inName, await fetchFile(file))
  const args = ["-i", inName, "-ac", "1", "-ar", "16000", "-vn"]
  if (maxSeconds) args.push("-t", String(maxSeconds))
  args.push("out.webm")
  await ff.exec(args)
  const data = await ff.readFile("out.webm")
  await ff.deleteFile(inName).catch(() => {})
  await ff.deleteFile("out.webm").catch(() => {})
  return new Blob([data.buffer], { type: "audio/webm" })
}

// قصّ المقاطع المُبقاة ودمجها في فيديو واحد
export async function cutAndConcat(file, segments, onLog = () => {}) {
  if (!segments.length) throw new Error("لا توجد مقاطع للتصدير")
  const ff = await getFF(onLog)
  const { fetchFile } = window.FFmpegUtil
  const inName = "src_" + file.name.replace(/[^\w.]/g, "_")
  await ff.writeFile(inName, await fetchFile(file))

  // filter_complex: trim لكل مقطع ثم concat
  const parts = []; let labels = ""
  segments.forEach(([s, e], i) => {
    parts.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`)
    parts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`)
    labels += `[v${i}][a${i}]`
  })
  const filter = parts.join(";") + ";" + labels + `concat=n=${segments.length}:v=1:a=1[outv][outa]`
  await ff.exec([
    "-i", inName, "-filter_complex", filter,
    "-map", "[outv]", "-map", "[outa]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "out.mp4",
  ])
  const data = await ff.readFile("out.mp4")
  await ff.deleteFile(inName).catch(() => {})
  await ff.deleteFile("out.mp4").catch(() => {})
  return new Blob([data.buffer], { type: "video/mp4" })
}

// قصّ مقطع واحد (للسوشيال)
export async function clipOne(file, start, end, onLog = () => {}) {
  return cutAndConcat(file, [[+start, +end]], onLog)
}

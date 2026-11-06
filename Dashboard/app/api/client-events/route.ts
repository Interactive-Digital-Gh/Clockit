import { diagnosticEvents, diagnosticPage } from "@/lib/client-diagnostics"

// A process-wide budget bounds log volume even for unauthenticated clients.
let windowStart = Date.now()
let count = 0
export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  try {
    if (!origin || new URL(origin).host !== request.headers.get("host")) return new Response(null, { status: 403 })
  } catch { return new Response(null, { status: 403 }) }
  if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); count = 0 }
  if (++count > 120) return new Response(null, { status: 429 })
  try {
    const reader = request.body?.getReader()
    if (!reader) return new Response(null, { status: 400 })
    let size = 0
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 4096) { await reader.cancel(); return new Response(null, { status: 413 }) }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const data = JSON.parse(new TextDecoder().decode(bytes))
    if (!diagnosticEvents.includes(data.event) || !/^[a-z0-9]{1,12}$/.test(data.reference)) return new Response(null, { status: 400 })
    const ua = request.headers.get("user-agent") ?? ""
    const browser = ua.match(/(?:Version|CriOS|Chrome|Firefox)\/[\d.]+/g)?.slice(0, 3) ?? []
    console.warn("clockit.client", JSON.stringify({
      time: new Date().toISOString(), event: data.event, reference: data.reference,
      page: diagnosticPage(data.page), build: typeof data.build === "string" && /^[a-z0-9-]{1,40}$/.test(data.build) ? data.build : "unknown",
      category: ["TypeError", "ReferenceError", "SyntaxError", "RangeError", "ChunkLoadError", "Error"].includes(data.category) ? data.category : "unknown",
      frames: Array.isArray(data.frames) ? data.frames.filter((f: unknown) => typeof f === "string" && /^\/_next\/static\/[a-zA-Z0-9_./-]+(?::\d+(?::\d+)?)?$/.test(f)).slice(0, 5) : [],
      status: Number.isInteger(data.status) && data.status >= 400 && data.status <= 599 ? data.status : undefined,
      osVersion: ua.match(/(?:CPU (?:iPhone )?OS|Android) ([\d._]+)/)?.[1],
      device: /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : "other", browser,
    }))
    return new Response(null, { status: 204 })
  } catch { return new Response(null, { status: 400 }) }
}

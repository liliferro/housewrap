import { NextRequest, NextResponse } from "next/server";
import { photonAddresses } from "@/lib/address";
export const runtime = "nodejs";
// Best-effort burst protection per server instance, bounded in memory.
const requests = new Map<string, { count: number; until: number }>();
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 5 || q.length > 200)
    return NextResponse.json({ results: [] }, { status: 400 });
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  for (const [key, value] of requests)
    if (value.until < now) requests.delete(key);
  const bucket = requests.get(ip) || { count: 0, until: now + 60000 };
  if (bucket.count >= 30)
    return NextResponse.json(
      { error: "Espera un momento antes de volver a buscar." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  if (requests.size >= 2000 && !requests.has(ip))
    return NextResponse.json(
      { error: "Búsqueda ocupada. Intenta de nuevo." },
      { status: 503 },
    );
  bucket.count++;
  requests.set(ip, bucket);
  const url = new URL(
    "/api/",
    process.env.PHOTON_BASE_URL || "https://photon.komoot.io",
  );
  url.search = new URLSearchParams({
    q,
    limit: "8",
    lang: "en",
    countrycode: "US",
    lat: "33.749",
    lon: "-84.388",
    layer: "house",
  }).toString();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: {
        "User-Agent": "QualityHousewrap/1.0 (https://housewrap.vercel.app)",
      },
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error("Provider unavailable");
    return NextResponse.json({
      results: photonAddresses(await response.json()),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "El mapa no está disponible ahora. Intenta nuevamente o registra la dirección como pendiente de verificar.",
      },
      { status: 503 },
    );
  }
}

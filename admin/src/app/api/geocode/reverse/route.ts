import { NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  const latNum = lat != null ? parseFloat(lat) : NaN;
  const lonNum = lon != null ? parseFloat(lon) : NaN;

  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
    return NextResponse.json(
      { error: "lat and lon query params required" },
      { status: 400 },
    );
  }

  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("lat", String(latNum));
    url.searchParams.set("lon", String(lonNum));
    url.searchParams.set("format", "json");
    url.searchParams.set("zoom", "14");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "WorkFlowAdmin/1.0 (https://github.com/your-org/workflow)",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Nominatim HTTP ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Reverse geocode proxy error:", err);
    return NextResponse.json(
      { error: "Geocoding service unavailable" },
      { status: 502 },
    );
  }
}

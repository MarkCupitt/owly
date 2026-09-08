import { NextRequest, NextResponse } from "next/server";
import { fetchNvidiaModels } from "@/lib/ai/providers";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "settings:read");
  if (!isAuthenticated(auth)) return auth;

  const apiKey = req.headers.get("x-api-key");

  if (!apiKey) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  try {
    const models = await fetchNvidiaModels(apiKey);
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}

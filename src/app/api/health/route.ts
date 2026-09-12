import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PROVIDER_CONFIGS } from "@/lib/ai/provider-configs";

const startTime = Date.now();

export async function GET() {
  const checks: Record<string, string> = {};

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "connected";
  } catch {
    checks.database = "error";
  }

  // AI provider reachability check — uses the configured provider
  const providerKey = "ai";
  try {
    const settings = await prisma.settings.findFirst({
      select: { aiApiKey: true, aiProvider: true, aiBaseUrl: true },
    });
    const provider = settings?.aiProvider || "openai";
    const providerCfg = PROVIDER_CONFIGS[provider];
    const apiKey = settings?.aiApiKey || "";

    if (apiKey || (providerCfg && !providerCfg.apiKeyRequired)) {
      const baseURL = settings?.aiBaseUrl || providerCfg?.baseURL || "https://api.openai.com/v1";
      const checkUrl = baseURL.replace(/\/$/, "") + "/models";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(checkUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      checks[providerKey] = res.ok ? "reachable" : `error (${res.status})`;
    } else {
      checks[providerKey] = "not_configured";
    }
  } catch {
    checks[providerKey] = "unreachable";
  }

  // Uptime
  const uptimeMs = Date.now() - startTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  // Memory
  const mem = process.memoryUsage();

  const allHealthy = Object.values(checks).every(
    (v) => v === "connected" || v === "reachable" || v === "not_configured"
  );

  return NextResponse.json({
    status: allHealthy ? "ok" : "degraded",
    version: process.env.npm_package_version || "0.1.1",
    environment: process.env.NODE_ENV || "development",
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    services: checks,
    memory: {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heap: `${Math.round(mem.heapUsed / 1024 / 1024)}/${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
    },
  });
}

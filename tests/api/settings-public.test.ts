import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { parseJsonResponse } from "../helpers/request";
import { fixtures } from "../helpers/fixtures";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

describe("GET /api/settings/public", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns only safe public fields (no secrets)", async () => {
    mockPrisma.settings.findUnique.mockResolvedValue({ ...fixtures.settings });

    const { GET } = await import("@/app/api/settings/public/route");
    const response = await GET();
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.appName).toBe("Owly");
    expect(data.appNameShort).toBe("Owly");
    expect(data.businessName).toBe("Test Business");
    expect(data.themePreset).toBe("owly-default");
    expect(data.themeLogoUrl).toBeDefined();
    expect(data.themeFaviconUrl).toBeDefined();
  });

  it("does not leak secret fields", async () => {
    mockPrisma.settings.findUnique.mockResolvedValue({ ...fixtures.settings });

    const { GET } = await import("@/app/api/settings/public/route");
    const response = await GET();
    const data = await parseJsonResponse(response);
    const jsonString = JSON.stringify(data);

    expect(jsonString).not.toContain("sk-test-key-12345");
    expect(jsonString).not.toContain("smtp-password");
    expect(jsonString).not.toContain("imap-password");
    expect(jsonString).not.toContain("twilio-auth-token");
    expect(jsonString).not.toContain("el-key-12345");
    expect(jsonString).not.toContain("wa-key-12345");
    expect(data.aiApiKey).toBeUndefined();
    expect(data.smtpPass).toBeUndefined();
    expect(data.twilioToken).toBeUndefined();
  });

  it("creates default settings if none exist", async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(null);
    mockPrisma.settings.create.mockResolvedValue({
      id: "default",
      appName: null,
      appNameShort: null,
      systemName: null,
      businessName: null,
      themePreset: null,
      themeOverridesLight: null,
      themeOverridesDark: null,
      themeLogoUrl: null,
      themeLogoDarkUrl: null,
      themeFaviconUrl: null,
    });

    const { GET } = await import("@/app/api/settings/public/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockPrisma.settings.create).toHaveBeenCalled();
  });

  it("handles database errors", async () => {
    mockPrisma.settings.findUnique.mockRejectedValue(new Error("DB error"));

    const { GET } = await import("@/app/api/settings/public/route");
    const response = await GET();

    expect(response.status).toBe(500);
  });
});

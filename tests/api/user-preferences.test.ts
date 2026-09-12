import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

describe("GET /api/user/preferences", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns user theme preferences", async () => {
    mockPrisma.admin.findUnique.mockResolvedValue({
      id: "test-admin-id",
      themePreset: "owly-default",
      themeOverridesLight: { "--owly-primary": "#FF6B00" },
      themeOverridesDark: { "--owly-primary": "#FF6B00" },
      themeMode: "dark",
    });

    const { GET } = await import("@/app/api/user/preferences/route");
    const request = createRequest("/api/user/preferences");
    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.themePreset).toBe("owly-default");
    expect(data.themeMode).toBe("dark");
    expect(data.themeOverridesLight).toEqual({ "--owly-primary": "#FF6B00" });
  });

  it("returns 404 when user not found", async () => {
    mockPrisma.admin.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/user/preferences/route");
    const request = createRequest("/api/user/preferences");
    const response = await GET(request);

    expect(response.status).toBe(404);
  });

  it("handles database errors", async () => {
    mockPrisma.admin.findUnique.mockRejectedValue(new Error("DB error"));

    const { GET } = await import("@/app/api/user/preferences/route");
    const request = createRequest("/api/user/preferences");
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});

describe("PUT /api/user/preferences", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates user theme preferences", async () => {
    mockPrisma.admin.update.mockResolvedValue({
      id: "test-admin-id",
      themePreset: "mono",
      themeOverridesLight: {},
      themeOverridesDark: {},
      themeMode: "light",
    });

    const { PUT } = await import("@/app/api/user/preferences/route");
    const request = createRequest("/api/user/preferences", {
      method: "PUT",
      body: { themePreset: "mono", themeMode: "light" },
    });
    const response = await PUT(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.themePreset).toBe("mono");
    expect(data.themeMode).toBe("light");
    expect(mockPrisma.admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "test-admin-id" },
        data: { themePreset: "mono", themeMode: "light" },
      })
    );
  });

  it("rejects invalid themeMode value", async () => {
    const { PUT } = await import("@/app/api/user/preferences/route");
    const request = createRequest("/api/user/preferences", {
      method: "PUT",
      body: { themeMode: "invalid" },
    });
    const response = await PUT(request);

    expect(response.status).toBe(400);
  });

  it("rejects unknown fields", async () => {
    const { PUT } = await import("@/app/api/user/preferences/route");
    const request = createRequest("/api/user/preferences", {
      method: "PUT",
      body: { themePreset: "mono", hackField: "malicious" },
    });
    const response = await PUT(request);

    expect(response.status).toBe(400);
  });

  it("accepts theme overrides with valid colors", async () => {
    mockPrisma.admin.update.mockResolvedValue({
      id: "test-admin-id",
      themePreset: "owly-default",
      themeOverridesLight: { "--owly-primary": "#FF6B00" },
      themeOverridesDark: { "--owly-primary": "#FF6B00" },
      themeMode: "system",
    });

    const { PUT } = await import("@/app/api/user/preferences/route");
    const request = createRequest("/api/user/preferences", {
      method: "PUT",
      body: {
        themeOverridesLight: { "--owly-primary": "#FF6B00" },
        themeOverridesDark: { "--owly-primary": "#FF6B00" },
      },
    });
    const response = await PUT(request);

    expect(response.status).toBe(200);
  });

  it("handles database errors on update", async () => {
    mockPrisma.admin.update.mockRejectedValue(new Error("DB error"));

    const { PUT } = await import("@/app/api/user/preferences/route");
    const request = createRequest("/api/user/preferences", {
      method: "PUT",
      body: { themeMode: "dark" },
    });
    const response = await PUT(request);

    expect(response.status).toBe(500);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

describe("Channels API - Custom Channels", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    (prisma.channel.findMany as ReturnType<typeof vi.fn>).mockReset();
    (prisma.channel.upsert as ReturnType<typeof vi.fn>).mockReset();
    (prisma.channel.count as ReturnType<typeof vi.fn>).mockReset();
  });

  it("GET should return built-in channels plus custom channels", async () => {
    const { GET } = await import("@/app/api/channels/route");
    const builtinChannel = {
      id: "ch-wa",
      type: "whatsapp",
      isActive: true,
      config: {},
      status: "connected",
      isCustom: false,
      displayName: "",
      outboundWebhookUrl: "",
      outboundWebhookHeaders: {},
      autoReplyEnabled: true,
      disabledAt: null,
      disabledReason: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const customChannel = {
      id: "ch-msg",
      type: "messenger",
      isActive: true,
      config: {},
      status: "connected",
      isCustom: true,
      displayName: "Facebook Messenger",
      outboundWebhookUrl: "https://n8n.example.com/webhook/reply",
      outboundWebhookHeaders: {},
      autoReplyEnabled: true,
      disabledAt: null,
      disabledReason: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.channel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      builtinChannel,
      customChannel,
    ]);

    const request = createRequest("/api/channels");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await parseJsonResponse(response);
    expect(Array.isArray(data)).toBe(true);
    // Should include all 5 built-in types + 1 custom
    expect(data.length).toBe(6);
    const types = data.map((ch: { type: string }) => ch.type);
    expect(types).toContain("whatsapp");
    expect(types).toContain("messenger");
    expect(types).toContain("email");
    expect(types).toContain("phone");
    expect(types).toContain("sms");
    expect(types).toContain("telegram");
  });

  it("POST should create a custom channel with isCustom=true", async () => {
    const { POST } = await import("@/app/api/channels/route");
    const createdChannel = {
      id: "ch-1",
      type: "instagram",
      isActive: true,
      config: {},
      isCustom: true,
      displayName: "Instagram DMs",
      outboundWebhookUrl: "https://n8n.example.com/webhook/ig-reply",
      outboundWebhookHeaders: {},
      autoReplyEnabled: false,
      status: "disconnected",
    };
    (prisma.channel.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(createdChannel);

    const request = createRequest("/api/channels", {
      method: "POST",
      body: {
        type: "instagram",
        isActive: true,
        displayName: "Instagram DMs",
        outboundWebhookUrl: "https://n8n.example.com/webhook/ig-reply",
        autoReplyEnabled: false,
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await parseJsonResponse(response);
    expect(data.type).toBe("instagram");
    expect(data.isCustom).toBe(true);
    expect(prisma.channel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          type: "instagram",
          isCustom: true,
          displayName: "Instagram DMs",
          outboundWebhookUrl: "https://n8n.example.com/webhook/ig-reply",
          autoReplyEnabled: false,
        }),
      })
    );
  });

  it("POST should disable a channel with reason and timestamp", async () => {
    const { POST } = await import("@/app/api/channels/route");
    (prisma.channel.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "messenger",
      isActive: false,
      isCustom: true,
      displayName: "Facebook Messenger",
      disabledAt: new Date(),
      disabledReason: "No longer needed",
    });

    const request = createRequest("/api/channels", {
      method: "POST",
      body: {
        type: "messenger",
        isActive: false,
        disabledReason: "No longer needed",
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(prisma.channel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isActive: false,
          disabledReason: "No longer needed",
        }),
      })
    );
  });

  it("POST should re-enable a channel clearing disabledAt and reason", async () => {
    const { POST } = await import("@/app/api/channels/route");
    (prisma.channel.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "messenger",
      isActive: true,
      isCustom: true,
      displayName: "Facebook Messenger",
      disabledAt: null,
      disabledReason: "",
    });

    const request = createRequest("/api/channels", {
      method: "POST",
      body: {
        type: "messenger",
        isActive: true,
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(prisma.channel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isActive: true,
          disabledAt: null,
          disabledReason: "",
        }),
      })
    );
  });

  it("POST should reject request without type", async () => {
    const { POST } = await import("@/app/api/channels/route");
    const request = createRequest("/api/channels", {
      method: "POST",
      body: {
        isActive: true,
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

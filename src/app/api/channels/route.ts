import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";

const BUILTIN_CHANNEL_TYPES = ["whatsapp", "email", "phone", "sms", "telegram"];

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "channels:read");
  if (!isAuthenticated(auth)) return auth;

  try {
    const channels = await prisma.channel.findMany({
      orderBy: [{ isCustom: "asc" }, { type: "asc" }],
    });

    const channelMap = new Map(channels.map((ch) => [ch.type, ch]));

    // Always include built-in channels (even if not yet in DB)
    const result = BUILTIN_CHANNEL_TYPES.map((type) => {
      const existing = channelMap.get(type);
      if (existing) return existing;
      return {
        id: null,
        type,
        isActive: false,
        config: {},
        status: "disconnected",
        isCustom: false,
        displayName: "",
        outboundWebhookUrl: "",
        outboundWebhookHeaders: {},
        autoReplyEnabled: true,
        disabledAt: null,
        disabledReason: "",
        createdAt: null,
        updatedAt: null,
      };
    });

    // Append custom channels
    const customChannels = channels.filter((ch) => ch.isCustom);
    result.push(...customChannels);

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Failed to fetch channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const body = await request.json();
    const {
      type,
      isActive,
      config,
      displayName,
      outboundWebhookUrl,
      outboundWebhookHeaders,
      autoReplyEnabled,
      disabledReason,
    } = body;

    if (!type || typeof type !== "string") {
      return NextResponse.json(
        { error: "Channel type is required" },
        { status: 400 }
      );
    }

    const isBuiltin = BUILTIN_CHANNEL_TYPES.includes(type);

    // Build update data — only include fields that are provided
    const updateData: Record<string, unknown> = {};
    if (typeof isActive === "boolean") {
      updateData.isActive = isActive;
      if (!isActive) {
        updateData.disabledAt = new Date();
        updateData.disabledReason = disabledReason || "Manually disabled";
      } else {
        updateData.disabledAt = null;
        updateData.disabledReason = "";
      }
    }
    if (config !== undefined) updateData.config = config;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (outboundWebhookUrl !== undefined) updateData.outboundWebhookUrl = outboundWebhookUrl;
    if (outboundWebhookHeaders !== undefined) updateData.outboundWebhookHeaders = outboundWebhookHeaders;
    if (typeof autoReplyEnabled === "boolean") updateData.autoReplyEnabled = autoReplyEnabled;

    const channel = await prisma.channel.upsert({
      where: { type },
      update: updateData,
      create: {
        type,
        isActive: typeof isActive === "boolean" ? isActive : false,
        config: config ?? {},
        isCustom: !isBuiltin,
        displayName: displayName || type,
        outboundWebhookUrl: outboundWebhookUrl || "",
        outboundWebhookHeaders: outboundWebhookHeaders || {},
        autoReplyEnabled: typeof autoReplyEnabled === "boolean" ? autoReplyEnabled : true,
        status: "disconnected",
        ...(typeof isActive === "boolean" && !isActive
          ? { disabledAt: new Date(), disabledReason: disabledReason || "Manually disabled" }
          : {}),
      },
    });

    return NextResponse.json(channel, { status: 200 });
  } catch (error) {
    logger.error("Failed to save channel:", error);
    return NextResponse.json(
      { error: "Failed to save channel" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: "default" },
      });
    }

    return NextResponse.json({
      appName: settings.appName,
      appNameShort: settings.appNameShort,
      systemName: settings.systemName,
      businessName: settings.businessName,
      themePreset: settings.themePreset,
      themeOverridesLight: settings.themeOverridesLight,
      themeOverridesDark: settings.themeOverridesDark,
      themeLogoUrl: settings.themeLogoUrl,
      themeLogoDarkUrl: settings.themeLogoDarkUrl,
      themeFaviconUrl: settings.themeFaviconUrl,
    });
  } catch (error) {
    logger.error("Failed to fetch public settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

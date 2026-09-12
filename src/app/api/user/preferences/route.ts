import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateUserPreferencesSchema, validateBody } from "@/lib/validations";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!isAuthenticated(auth)) return auth;

  try {
    const admin = await prisma.admin.findUnique({
      where: { id: auth.userId },
      select: {
        themePreset: true,
        themeOverridesLight: true,
        themeOverridesDark: true,
        themeMode: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(admin);
  } catch (error) {
    logger.error("Failed to fetch user preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!isAuthenticated(auth)) return auth;

  try {
    const body = await request.json();

    const validation = validateBody(updateUserPreferencesSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updated = await prisma.admin.update({
      where: { id: auth.userId },
      data: validation.data,
      select: {
        themePreset: true,
        themeOverridesLight: true,
        themeOverridesDark: true,
        themeMode: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error("Failed to update user preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}

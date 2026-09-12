import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/owly?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function env(key: string, fallback: string): string {
  const val = process.env[key];
  return val !== undefined && val.length > 0 ? val : fallback;
}

function generateApiKey(): string {
  return "owly_" + crypto.randomBytes(32).toString("hex");
}

async function main() {
  const adminUsername = env("SEED_ADMIN_USERNAME", "markcupitt");
  const adminPassword = env("SEED_ADMIN_PASSWORD", "password1");
  const adminName = env("SEED_ADMIN_NAME", "Mark Cupitt");

  const businessName = env("SEED_BUSINESS_NAME", "Powerdeck Solutions");
  const businessDesc = env(
    "SEED_BUSINESS_DESC",
    "INTELLIGENT ENERGY MANAGEMENT — The home and business energy management and control platform for solar, inverters, and smart devices."
  );
  const appName = env("SEED_APP_NAME", "PowerDeck HelpDesk");
  const appNameShort = env("SEED_APP_NAME_SHORT", "PowerDeck");
  const systemName = env("SEED_SYSTEM_NAME", "HelpDesk");
  const welcomeMessage = env(
    "SEED_WELCOME_MESSAGE",
    "Hi There, Welcome to PowerDeck, How can I help you solve your energy management problems?"
  );
  const tone = env("SEED_TONE", "friendly");

  const themePreset = env("SEED_THEME_PRESET", "owly-default");
  const aiProvider = env("SEED_AI_PROVIDER", "gemini");
  const aiModel = env("SEED_AI_MODEL", "gemini-2.5-flash");
  const aiApiKey = env("SEED_AI_API_KEY", "");
  const aiBaseUrl = env("SEED_AI_BASE_URL", "");

  const apiKeyName = env("SEED_API_KEY_NAME", "PowerDeck Upstream Integration");
  const upstreamSystemLabel = env(
    "SEED_UPSTREAM_SYSTEM_LABEL",
    "PowerDeck Client Portal"
  );
  const upstreamIdentityEnabled =
    env("SEED_UPSTREAM_IDENTITY_ENABLED", "true") === "true";

  // ── Admin user ──
  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  await prisma.admin.upsert({
    where: { username: adminUsername },
    update: { password: hashedPassword, name: adminName, role: "admin" },
    create: {
      username: adminUsername,
      password: hashedPassword,
      name: adminName,
      role: "admin",
    },
  });

  // ── Settings ──
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {
      businessName,
      businessDesc,
      appName,
      appNameShort,
      systemName,
      welcomeMessage,
      tone,
      themePreset,
      aiProvider,
      aiModel,
      ...(aiApiKey ? { aiApiKey } : {}),
      ...(aiBaseUrl ? { aiBaseUrl } : {}),
      upstreamIdentityEnabled,
      upstreamIdentitySystemLabel: upstreamSystemLabel,
    },
    create: {
      id: "default",
      businessName,
      businessDesc,
      appName,
      appNameShort,
      systemName,
      welcomeMessage,
      tone,
      themePreset,
      language: "auto",
      aiProvider,
      aiModel,
      aiApiKey,
      aiBaseUrl,
      upstreamIdentityEnabled,
      upstreamIdentitySystemLabel: upstreamSystemLabel,
    },
  });

  // ── API Key ──
  const existingKey = await prisma.apiKey.findFirst({
    where: { name: apiKeyName },
  });
  let fullApiKey: string;
  if (existingKey) {
    fullApiKey = existingKey.key;
    console.log(`  ℹ API key "${apiKeyName}" already exists (keeping)`);
  } else {
    fullApiKey = generateApiKey();
    await prisma.apiKey.create({
      data: { name: apiKeyName, key: fullApiKey, isActive: true },
    });
  }

  // Create default channels
  for (const type of ["whatsapp", "email", "phone"]) {
    await prisma.channel.upsert({
      where: { type },
      update: {},
      create: { type, isActive: false, status: "disconnected" },
    });
  }

  // Create default business hours
  await prisma.businessHours.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  console.log("\n━━━ Seed Complete ━━━");
  console.log(`  Admin:    ${adminUsername} / ${adminPassword}`);
  console.log(`  Business: ${businessName}`);
  console.log(`  App:      ${appName} (${appNameShort})`);
  console.log(`  System:   ${systemName}`);
  console.log(`  Theme:    ${themePreset}`);
  console.log(`  AI:       ${aiProvider} / ${aiModel}`);
  console.log(`  API Key:  ${fullApiKey}`);
  console.log(`  Upstream: ${upstreamSystemLabel} (enabled: ${upstreamIdentityEnabled})`);
  console.log("━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

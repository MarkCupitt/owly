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

  // Create sample departments
  const techDept = await prisma.department.upsert({
    where: { id: "dept-tech" },
    update: {},
    create: {
      id: "dept-tech",
      name: "Technical Support",
      description: "Handles technical issues, bugs, and product troubleshooting",
      email: "tech@powerdeck.work",
    },
  });

  const salesDept = await prisma.department.upsert({
    where: { id: "dept-sales" },
    update: {},
    create: {
      id: "dept-sales",
      name: "Sales",
      description: "Handles pricing, quotes, and purchase inquiries",
      email: "sales@powerdeck.work",
    },
  });

  const billingDept = await prisma.department.upsert({
    where: { id: "dept-billing" },
    update: {},
    create: {
      id: "dept-billing",
      name: "Billing",
      description: "Handles invoices, payments, and refunds",
      email: "billing@powerdeck.work",
    },
  });

  // Create sample team members
  const members = [
    { id: "member-1", name: "John Smith", email: "john@powerdeck.work", role: "Lead", expertise: "solar, inverters, energy management", departmentId: techDept.id },
    { id: "member-2", name: "Sarah Johnson", email: "sarah@powerdeck.work", role: "Member", expertise: "networking, infrastructure, deployment", departmentId: techDept.id },
    { id: "member-3", name: "Mike Davis", email: "mike@powerdeck.work", role: "Lead", expertise: "pricing, enterprise deals, partnerships", departmentId: salesDept.id },
    { id: "member-4", name: "Emily Brown", email: "emily@powerdeck.work", role: "Lead", expertise: "invoices, refunds, payment processing", departmentId: billingDept.id },
  ];

  for (const m of members) {
    await prisma.teamMember.upsert({
      where: { id: m.id },
      update: {},
      create: m,
    });
  }

  // Create sample knowledge base
  const categories = [
    { id: "cat-faq", name: "FAQ", description: "Frequently asked questions", icon: "help-circle", color: "#4A7C9B", sortOrder: 0 },
    { id: "cat-products", name: "Products", description: "Product information and features", icon: "package", color: "#22C55E", sortOrder: 1 },
    { id: "cat-policies", name: "Policies", description: "Return, refund, and shipping policies", icon: "shield", color: "#F59E0B", sortOrder: 2 },
  ];

  for (const c of categories) {
    await prisma.category.upsert({ where: { id: c.id }, update: {}, create: c });
  }

  const entries = [
    { id: "entry-1", categoryId: "cat-faq", title: "Business Hours", content: "We are open Monday to Friday, 9:00 AM to 6:00 PM. Our AI assistant is available 24/7 for basic inquiries.", priority: 10 },
    { id: "entry-2", categoryId: "cat-faq", title: "Contact Information", content: "You can reach us via email at support@powerdeck.work, or through the PowerDeck platform. Our AI assistant is always here to help!", priority: 9 },
    { id: "entry-3", categoryId: "cat-products", title: "Platform Overview", content: "PowerDeck is an intelligent energy management platform for solar, inverters, and smart devices. Contact our sales team for detailed pricing and custom solutions.", priority: 5 },
    { id: "entry-4", categoryId: "cat-policies", title: "Support Policy", content: "We provide full support for all PowerDeck installations. To initiate a support request, please contact our team through the helpdesk.", priority: 8 },
    { id: "entry-5", categoryId: "cat-policies", title: "Refund Policy", content: "Refunds are processed within 5-10 business days after we receive the request. The refund will be credited to the original payment method.", priority: 7 },
  ];

  for (const e of entries) {
    await prisma.knowledgeEntry.upsert({ where: { id: e.id }, update: {}, create: e });
  }

  // Create sample tags
  const tags = [
    { id: "tag-1", name: "Urgent", color: "#EF4444" },
    { id: "tag-2", name: "VIP", color: "#F59E0B" },
    { id: "tag-3", name: "Follow-up", color: "#3B82F6" },
    { id: "tag-4", name: "Resolved", color: "#22C55E" },
    { id: "tag-5", name: "Bug", color: "#8B5CF6" },
  ];

  for (const t of tags) {
    await prisma.tag.upsert({ where: { name: t.name }, update: {}, create: t });
  }

  // Create sample canned responses
  const cannedResponses = [
    { id: "cr-1", title: "Greeting", content: "Hello! Thank you for reaching out to PowerDeck. How can I help you today?", category: "General", shortcut: "/greeting" },
    { id: "cr-2", title: "Closing", content: "Thank you for contacting PowerDeck! Is there anything else I can help you with?", category: "General", shortcut: "/closing" },
    { id: "cr-3", title: "Escalation", content: "I'll connect you with a specialist who can better assist you with this matter. Please hold on.", category: "Support", shortcut: "/escalate" },
    { id: "cr-4", title: "Energy Inquiry", content: "I can help with your energy management questions. Could you provide more details about your solar or inverter setup?", category: "Support", shortcut: "/energy" },
  ];

  for (const cr of cannedResponses) {
    await prisma.cannedResponse.upsert({ where: { id: cr.id }, update: {}, create: cr });
  }

  // Create sample SLA rules
  const slaRules = [
    { id: "sla-1", name: "Standard Response", description: "Default response time for all channels", firstResponseMins: 30, resolutionMins: 480 },
    { id: "sla-2", name: "Urgent Priority", description: "Fast response for urgent issues", priority: "urgent", firstResponseMins: 5, resolutionMins: 60 },
  ];

  for (const sla of slaRules) {
    await prisma.sLARule.upsert({ where: { id: sla.id }, update: {}, create: sla });
  }

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

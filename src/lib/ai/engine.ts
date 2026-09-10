import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { owlyTools, executeToolCall } from "./tools";
import { emitNewMessage } from "@/lib/realtime";
import { analyzeSentiment, detectIntent, estimateConfidence, requiresHumanApproval } from "./guardrails";
import { createProvider } from "./providers";
import { evaluateRules } from "@/lib/automation";
import { linkUpstreamIdentity } from "@/lib/upstream-identity";
import { isFakeEmailSync, extractEmail } from "@/lib/fake-email";
import { createNotification } from "@/lib/notifications";
import { checkAndProposeMatches } from "@/lib/customer-matcher";
import type {
  AIMessage,
  AIConfig,
  ConversationContext,
  KnowledgeItem,
} from "./types";

function buildSystemPrompt(context: ConversationContext): string {
  const toneGuide: Record<string, string> = {
    friendly:
      "Be warm, approachable, and conversational. Use a casual but professional tone.",
    professional:
      "Be polished and business-like. Maintain a confident, competent tone while remaining personable.",
    formal:
      "Be professional, polished, and courteous. Use formal language and proper grammar.",
    technical:
      "Be precise and detailed. Use technical terminology when appropriate and provide thorough explanations.",
  };

  const knowledgeSection =
    context.knowledgeBase.length > 0
      ? context.knowledgeBase
          .sort((a, b) => b.priority - a.priority)
          .map(
            (k) =>
              `[${k.category}] ${k.title}:\n${k.content}`
          )
          .join("\n\n---\n\n")
      : "No specific knowledge base entries available. Answer based on general knowledge about the business.";

  return `You are ${context.appName}, the AI customer support assistant for ${context.businessName}.

${context.businessDesc ? `About the business: ${context.businessDesc}` : ""}

## Communication Style
${toneGuide[context.tone] || toneGuide.friendly}
${context.language !== "auto" ? `Always respond in: ${context.language}` : "Respond in the same language the customer uses."}

## Your Knowledge Base
Use the following information to answer customer questions accurately:

${knowledgeSection}

## Important Guidelines
- Always be helpful and try to resolve the customer's issue
- If you cannot answer a question from the knowledge base, honestly say so and offer to connect them with a team member
- Use the create_ticket tool when a customer reports a problem that needs human intervention
- Use send_internal_email to notify relevant team members about urgent issues
- Use get_customer_history to check if the customer has contacted before
- Never make up information that isn't in your knowledge base
- Keep responses concise but thorough
- The customer is contacting via: ${context.channel}
${context.customerName !== "Unknown" ? `- Customer name: ${context.customerName}` : ""}
${context.customerIdentified === true ? `- Customer is identified and linked to ${context.upstreamSystemLabel || "upstream system"}` : ""}

## Customer Identification
${context.customerIdentified === false && context.identificationPrompt ? `- If the customer hasn't provided their email yet, ask for it using this prompt: "${context.identificationPrompt}"\n- Once the customer provides an email, acknowledge it and continue helping them.` : ""}

## Customer History
${context.customerHistory.length > 0 ? context.customerHistory.join("\n") : "This is the customer's first interaction."}`;
}

async function getKnowledgeBase(): Promise<KnowledgeItem[]> {
  const entries = await prisma.knowledgeEntry.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { priority: "desc" },
  });

  return entries.map((e: { category: { name: string }; title: string; content: string; priority: number }) => ({
    category: e.category.name,
    title: e.title,
    content: e.content,
    priority: e.priority,
  }));
}

async function getAIConfig(): Promise<AIConfig & ConversationContext> {
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: "default" } });
  }

  return {
    provider: settings.aiProvider,
    model: settings.aiModel,
    apiKey: settings.aiApiKey,
    maxTokens: settings.maxTokens,
    temperature: settings.temperature,
    aiBaseUrl: settings.aiBaseUrl || undefined,
    businessName: settings.businessName,
    businessDesc: settings.businessDesc,
    welcomeMessage: settings.welcomeMessage,
    tone: settings.tone,
    language: settings.language,
    knowledgeBase: [],
    customerName: "",
    customerHistory: [],
    channel: "",
    appName: settings.appName,
    upstreamSystemLabel: settings.upstreamIdentitySystemLabel || undefined,
    identificationPrompt: settings.customerIdentificationEnabled
      ? (settings.customerIdentificationPrompt || "").replace(/\{system_label\}/g, settings.upstreamIdentitySystemLabel || "our system")
      : undefined,
  };
}

export async function chat(
  conversationId: string,
  userMessage: string
): Promise<string> {
  const config = await getAIConfig();

  if (!config.apiKey) {
    return "AI is not configured. Please add your API key in Settings > AI Configuration.";
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 50 },
    },
  });

  if (!conversation) {
    return "Conversation not found.";
  }

  const knowledgeBase = await getKnowledgeBase();

  // Get customer info for identification context
  let customerIdentified: boolean | undefined;
  let customerEmail: string | undefined;
  if (conversation.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: conversation.customerId },
      select: { email: true, externalId: true, name: true },
    });
    if (customer) {
      customerEmail = customer.email || undefined;
      customerIdentified = !!customer.externalId || (!!customer.email && !isFakeEmailSync(customer.email, ["facebook.com"]));
    }
  }

  const context: ConversationContext = {
    ...config,
    knowledgeBase,
    customerName: conversation.customerName,
    channel: conversation.channel,
    customerHistory: [],
    customerIdentified,
    customerEmail,
  };

  // Email detection: check if the user message contains an email
  if (conversation.customerId) {
    const detectedEmail = extractEmail(userMessage);
    if (detectedEmail && !isFakeEmailSync(detectedEmail, ["facebook.com"])) {
      const customer = await prisma.customer.findUnique({
        where: { id: conversation.customerId },
        select: { email: true, externalId: true },
      });
      if (customer && (!customer.email || isFakeEmailSync(customer.email, ["facebook.com"]))) {
        await prisma.customer.update({
          where: { id: conversation.customerId },
          data: { email: detectedEmail },
        });
        // Trigger upstream identity lookup
        if (!customer.externalId) {
          linkUpstreamIdentity(conversation.customerId, detectedEmail).catch((err) => {
            logger.error("Upstream identity lookup failed", { error: err });
          });
        }
      }
    }
  }

  // Evaluate automation rules
  try {
    const matchedActions = await evaluateRules(
      { content: userMessage, channel: conversation.channel, customerName: conversation.customerName },
      { id: conversationId, channel: conversation.channel, customerName: conversation.customerName }
    );
    for (const action of matchedActions) {
      if (action.type === "keyword_alert") {
        await createNotification({
          type: "automation",
          title: `Keyword Alert: ${action.ruleName}`,
          message: `Triggered by message: "${userMessage.substring(0, 100)}"`,
          entityId: conversationId,
          entityType: "conversation",
          metadata: { ruleId: action.ruleId, actions: action.actions },
        });
      }
    }
  } catch (err) {
    logger.error("Automation rule evaluation failed", { error: err });
  }

  // Build message history
  const messages: AIMessage[] = [
    { role: "system", content: buildSystemPrompt(context) },
  ];

  for (const msg of conversation.messages) {
    if (msg.role === "customer") {
      messages.push({ role: "user", content: msg.content });
    } else if (msg.role === "assistant") {
      messages.push({ role: "assistant", content: msg.content });
    }
  }

  messages.push({ role: "user", content: userMessage });

  // Guardrails: check if human approval needed
  const approval = requiresHumanApproval(userMessage);
  if (approval.required) {
    const sentiment = analyzeSentiment(userMessage);
    const intent = detectIntent(userMessage);

    // Store metadata for dashboard visibility
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          escalationReason: approval.reason,
          sentiment: sentiment.sentiment,
          intent: intent.intent,
        },
      },
    });
  }

  // Save user message
  await prisma.message.create({
    data: {
      conversationId,
      role: "customer",
      content: userMessage,
    },
  });

  // Call AI
  const response = await callAI(config, messages, conversationId);

  // Save assistant message
  const savedMessage = await prisma.message.create({
    data: {
      conversationId,
      role: "assistant",
      content: response,
    },
  });

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Confidence scoring
  const confidence = estimateConfidence(response, knowledgeBase.length, false);
  if (confidence.shouldEscalate) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "escalated" },
    });
  }

  emitNewMessage(conversationId, { id: savedMessage.id, role: "assistant", content: response });

  return response;
}

async function callAI(
  config: AIConfig,
  messages: AIMessage[],
  conversationId: string,
  depth = 0
): Promise<string> {
  if (depth > 5) {
    return "I apologize, but I'm having trouble processing your request. Let me connect you with a team member.";
  }

  const provider = createProvider(config);

  let result;
  try {
    result = await provider.chat({
      model: config.model,
      messages,
      tools: owlyTools,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });
  } catch {
    return "I'm temporarily unable to process your request. Please try again in a moment, or I can connect you with a team member.";
  }

  if (
    result.finishReason === "tool_calls" &&
    result.toolCalls?.length
  ) {
    const toolCalls = result.toolCalls;

    messages.push({
      role: "assistant",
      content: result.content,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.function.arguments);
      const toolResult = await executeToolCall(
        toolCall.function.name,
        args,
        conversationId
      );

      messages.push({
        role: "tool",
        content: toolResult,
        tool_call_id: toolCall.id,
      });
    }

    return callAI(config, messages, conversationId, depth + 1);
  }

  return result.content || "I apologize, I could not generate a response.";
}

export async function createNewConversation(
  channel: string,
  customerName: string,
  customerContact: string,
  customerId?: string
) {
  return prisma.conversation.create({
    data: {
      channel,
      customerName,
      customerContact,
      ...(customerId && { customerId }),
    },
  });
}

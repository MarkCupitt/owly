import { NextRequest, NextResponse } from "next/server";
import { chat, createNewConversation } from "@/lib/ai/engine";
import { resolveCustomer } from "@/lib/customer-resolver";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      conversationId,
      channel,
      customerName,
      customerContact,
      customerEmail,
      customerId,
      customerSystem,
    } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message.length > 10000) {
      return NextResponse.json({ error: "Message exceeds maximum length of 10000 characters" }, { status: 400 });
    }

    let convId = conversationId;

    if (!convId) {
      const ch = channel || "widget";
      let name = customerName || "Website Visitor";
      let contact = customerContact || "";

      if (customerId && customerSystem) {
        contact = customerId;
      } else if (customerEmail) {
        contact = customerEmail;
      }

      if (contact) {
        try {
          await resolveCustomer(ch, contact, name, {
            senderEmail: customerEmail,
          });
        } catch (err) {
          logger.error("Failed to resolve customer:", err);
        }
      }

      const conversation = await createNewConversation(ch, name, contact);
      convId = conversation.id;
    }

    const response = await chat(convId, message.trim());

    return NextResponse.json({
      conversationId: convId,
      response,
    });
  } catch (error) {
    logger.error("Failed to process chat message:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

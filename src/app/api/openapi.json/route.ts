import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "HelpDesk API",
    description: "AI-powered customer support agent API. Multi-channel support for WhatsApp, Email, and Phone with autonomous AI actions.",
    version: "2026-04-07",
    contact: {
      name: "Hesper Labs",
      url: "https://github.com/Hesper-Labs/owly",
    },
    license: {
      name: "MIT",
      url: "https://github.com/Hesper-Labs/owly/blob/main/LICENSE",
    },
  },
  servers: [
    { url: "/api", description: "Current server" },
  ],
  tags: [
    { name: "Auth", description: "Authentication and setup" },
    { name: "Conversations", description: "Customer conversation management" },
    { name: "Messages", description: "Conversation messages" },
    { name: "Tickets", description: "Support ticket management" },
    { name: "Customers", description: "Customer CRM" },
    { name: "Knowledge", description: "Knowledge base management" },
    { name: "Team", description: "Team members and departments" },
    { name: "Automation", description: "Automation rules engine" },
    { name: "Webhooks", description: "Webhook management and delivery" },
    { name: "Channels", description: "Channel management (built-in and custom)" },
    { name: "Chat", description: "AI chat inference" },
    { name: "Settings", description: "System configuration" },
    { name: "Admin", description: "User and API key management" },
    { name: "Analytics", description: "Statistics and analytics" },
    { name: "System", description: "Health check and system info" },
  ],
  paths: {
    "/auth": {
      get: {
        tags: ["Auth"],
        summary: "Check auth status",
        responses: { "200": { description: "Auth status with user info or setup requirement" } },
      },
      post: {
        tags: ["Auth"],
        summary: "Login, setup, or logout",
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { action: { type: "string", enum: ["login", "setup", "logout"] }, username: { type: "string" }, password: { type: "string" } } } } },
        },
        responses: { "200": { description: "Success with auth token cookie" }, "401": { description: "Invalid credentials" } },
      },
    },
    "/conversations": {
      get: {
        tags: ["Conversations"],
        summary: "List conversations (paginated)",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          { name: "channel", in: "query", schema: { type: "string", enum: ["whatsapp", "email", "phone", "api"] } },
          { name: "status", in: "query", schema: { type: "string", enum: ["active", "resolved", "closed", "escalated"] } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated conversation list" } },
      },
      post: {
        tags: ["Conversations"],
        summary: "Create a conversation",
        requestBody: {
          content: { "application/json": { schema: { type: "object", required: ["channel"], properties: { channel: { type: "string" }, customerName: { type: "string" }, customerContact: { type: "string" } } } } },
        },
        responses: { "201": { description: "Created conversation" } },
      },
    },
    "/conversations/{id}": {
      get: { tags: ["Conversations"], summary: "Get conversation detail with messages, customer, tickets, and tags", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Conversation detail" }, "404": { description: "Not found" } } },
      put: { tags: ["Conversations"], summary: "Update conversation", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated conversation" } } },
      delete: { tags: ["Conversations"], summary: "Delete conversation", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/conversations/{id}/messages": {
      get: { tags: ["Messages"], summary: "List messages in conversation", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Message list" } } },
      post: { tags: ["Messages"], summary: "Add message to conversation", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "201": { description: "Created message" } } },
    },
    "/tickets": {
      get: { tags: ["Tickets"], summary: "List tickets (paginated)", parameters: [{ name: "page", in: "query", schema: { type: "integer" } }, { name: "limit", in: "query", schema: { type: "integer" } }, { name: "status", in: "query", schema: { type: "string" } }, { name: "priority", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Paginated ticket list" } } },
      post: { tags: ["Tickets"], summary: "Create a ticket", responses: { "201": { description: "Created ticket" } } },
    },
    "/customers": {
      get: { tags: ["Customers"], summary: "List customers (paginated)", responses: { "200": { description: "Paginated customer list" } } },
      post: { tags: ["Customers"], summary: "Create a customer", responses: { "201": { description: "Created customer" } } },
    },
    "/customers/{id}": {
      get: { tags: ["Customers"], summary: "Get customer detail with cross-channel conversations", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Customer with conversations" } } },
      put: { tags: ["Customers"], summary: "Update customer", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Customers"], summary: "Delete customer", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/customers/{id}/conversations": {
      get: { tags: ["Customers"], summary: "Unified cross-channel conversation timeline for a customer", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "channel", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Paginated conversation list across all channels" } } },
    },
    "/chat": {
      post: { tags: ["Chat"], summary: "Send a message and get AI response", requestBody: { content: { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { type: "string", maxLength: 10000 }, conversationId: { type: "string" }, channel: { type: "string" }, customerName: { type: "string" } } } } } }, responses: { "200": { description: "AI response with conversation ID" } } },
    },
    "/knowledge/entries": {
      get: { tags: ["Knowledge"], summary: "List knowledge entries (paginated)", responses: { "200": { description: "Paginated entries" } } },
      post: { tags: ["Knowledge"], summary: "Create knowledge entry", responses: { "201": { description: "Created entry" } } },
    },
    "/knowledge/categories": {
      get: { tags: ["Knowledge"], summary: "List categories (paginated)", responses: { "200": { description: "Paginated categories" } } },
      post: { tags: ["Knowledge"], summary: "Create category", responses: { "201": { description: "Created" } } },
    },
    "/automation": {
      get: { tags: ["Automation"], summary: "List automation rules (paginated)", responses: { "200": { description: "Paginated rules" } } },
      post: { tags: ["Automation"], summary: "Create automation rule", responses: { "201": { description: "Created rule" } } },
    },
    "/webhooks": {
      get: { tags: ["Webhooks"], summary: "List webhooks (paginated)", responses: { "200": { description: "Paginated webhooks" } } },
      post: { tags: ["Webhooks"], summary: "Create webhook", responses: { "201": { description: "Created webhook" } } },
    },
    "/webhooks/{id}/deliveries": {
      get: { tags: ["Webhooks"], summary: "List webhook deliveries with retry status", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string", enum: ["pending", "delivered", "failed"] } }], responses: { "200": { description: "Paginated delivery list" } } },
      post: { tags: ["Webhooks"], summary: "Retry a failed delivery", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Retry result" } } },
    },
    "/settings": {
      get: { tags: ["Settings"], summary: "Get settings (secrets masked)", responses: { "200": { description: "Settings with masked sensitive fields" } } },
      put: { tags: ["Settings"], summary: "Update settings", responses: { "200": { description: "Updated settings" } } },
    },
    "/stats": { get: { tags: ["Analytics"], summary: "Get summary statistics", responses: { "200": { description: "Stats overview" } } } },
    "/analytics": { get: { tags: ["Analytics"], summary: "Get detailed analytics", parameters: [{ name: "period", in: "query", schema: { type: "string", enum: ["7d", "30d", "90d"] } }], responses: { "200": { description: "Analytics data" } } } },
    "/export": { get: { tags: ["Analytics"], summary: "Export data (CSV/JSON)", parameters: [{ name: "type", in: "query", schema: { type: "string", enum: ["conversations", "tickets", "customers", "knowledge"] } }, { name: "format", in: "query", schema: { type: "string", enum: ["json", "csv"] } }, { name: "limit", in: "query", schema: { type: "integer", maximum: 50000 } }], responses: { "200": { description: "Exported data" } } } },
    "/health": { get: { tags: ["System"], summary: "Health check with service status", security: [], responses: { "200": { description: "Service health including database, OpenAI, memory, uptime" } } } },
    "/openapi.json": { get: { tags: ["System"], summary: "OpenAPI specification", security: [], responses: { "200": { description: "This document" } } } },
    "/webhooks/inbound": {
      post: {
        tags: ["Webhooks"],
        summary: "Receive inbound message from external system (n8n, Zapier, custom)",
        security: [],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["channel", "message"],
                properties: {
                  channel: { type: "string", description: "Channel type (e.g. messenger, instagram, email)" },
                  channelDisplayName: { type: "string", description: "Human-readable channel name" },
                  sender_name: { type: "string", description: "Sender's display name" },
                  sender_id: { type: "string", description: "Unique sender ID on the channel" },
                  sender_email: { type: "string", description: "Sender's email if available" },
                  message: { type: "string", description: "Message content" },
                  thread_id: { type: "string", description: "External thread/conversation ID" },
                  timestamp: { type: "string", description: "ISO 8601 timestamp" },
                  autoReply: { type: "boolean", description: "Whether to trigger AI auto-reply" },
                },
              },
            },
          },
        },
        parameters: [
          { name: "X-Webhook-Secret", in: "header", required: true, schema: { type: "string" }, description: "Webhook authentication secret" },
        ],
        responses: {
          "200": { description: "Message received and processed. Returns conversation ID and whether auto-reply was triggered." },
          "401": { description: "Missing or invalid X-Webhook-Secret" },
          "400": { description: "Missing required fields" },
        },
      },
    },
    "/channels": {
      get: { tags: ["Channels"], summary: "List all channels (built-in and custom)", responses: { "200": { description: "Array of channel objects with type, isActive, isCustom, displayName, outboundWebhookUrl, autoReplyEnabled" } } },
      post: { tags: ["Channels"], summary: "Create or update a channel", requestBody: { content: { "application/json": { schema: { type: "object", required: ["type"], properties: { type: { type: "string" }, isActive: { type: "boolean" }, displayName: { type: "string" }, outboundWebhookUrl: { type: "string" }, autoReplyEnabled: { type: "boolean" }, disabledReason: { type: "string" } } } } } }, responses: { "200": { description: "Created or updated channel" } } },
    },
    "/channels/{type}": {
      get: { tags: ["Channels"], summary: "Get channel details by type", parameters: [{ name: "type", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Channel details" } } },
      put: { tags: ["Channels"], summary: "Update channel configuration", parameters: [{ name: "type", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { isActive: { type: "boolean" }, displayName: { type: "string" }, config: { type: "object" }, outboundWebhookUrl: { type: "string" }, autoReplyEnabled: { type: "boolean" } } } } } }, responses: { "200": { description: "Updated channel" } } },
      post: { tags: ["Channels"], summary: "Perform channel action (connect, disconnect, test)", parameters: [{ name: "type", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", required: ["action"], properties: { action: { type: "string", enum: ["connect", "disconnect", "test", "status"] }, config: { type: "object" } } } } } }, responses: { "200": { description: "Action result" } } },
    },
    "/customers/{id}/notes": {
      get: { tags: ["Customers"], summary: "List customer notes", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "List of customer notes" } } },
      post: { tags: ["Customers"], summary: "Add a note to a customer", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", required: ["content"], properties: { content: { type: "string" } } } } } }, responses: { "201": { description: "Created note" } } },
    },
    "/automation/{id}": {
      put: { tags: ["Automation"], summary: "Update automation rule", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, isActive: { type: "boolean" }, priority: { type: "integer" }, conditions: { type: "object" }, actions: { type: "object" } } } } } }, responses: { "200": { description: "Updated rule" } } },
      delete: { tags: ["Automation"], summary: "Delete automation rule", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/webhooks/{id}": {
      get: { tags: ["Webhooks"], summary: "Get webhook details", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Webhook details" } } },
      put: { tags: ["Webhooks"], summary: "Update webhook", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" }, events: { type: "array", items: { type: "string" } }, isActive: { type: "boolean" }, secret: { type: "string" } } } } } }, responses: { "200": { description: "Updated webhook" } } },
      delete: { tags: ["Webhooks"], summary: "Delete webhook", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/webhooks/test": {
      post: { tags: ["Webhooks"], summary: "Send a test payload to a webhook URL", requestBody: { content: { "application/json": { schema: { type: "object", required: ["url"], properties: { url: { type: "string" }, secret: { type: "string" }, event: { type: "string" } } } } } }, responses: { "200": { description: "Test result with delivery status" } } },
    },
    "/knowledge/entries/{id}": {
      put: { tags: ["Knowledge"], summary: "Update knowledge entry", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated entry" } } },
      delete: { tags: ["Knowledge"], summary: "Delete knowledge entry", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/knowledge/categories/{id}": {
      put: { tags: ["Knowledge"], summary: "Update category", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Knowledge"], summary: "Delete category", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/knowledge/test": {
      post: { tags: ["Knowledge"], summary: "Test knowledge retrieval for a query", requestBody: { content: { "application/json": { schema: { type: "object", required: ["query"], properties: { query: { type: "string" } } } } } }, responses: { "200": { description: "Matching knowledge entries" } } },
    },
    "/tickets/{id}": {
      get: { tags: ["Tickets"], summary: "Get ticket details", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Ticket details" } } },
      put: { tags: ["Tickets"], summary: "Update ticket", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated ticket" } } },
      delete: { tags: ["Tickets"], summary: "Delete ticket", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/team/members": {
      get: { tags: ["Team"], summary: "List team members (paginated)", responses: { "200": { description: "Paginated team members" } } },
      post: { tags: ["Team"], summary: "Invite a team member", requestBody: { content: { "application/json": { schema: { type: "object", required: ["email", "role"], properties: { email: { type: "string" }, role: { type: "string" }, name: { type: "string" } } } } } }, responses: { "201": { description: "Invited member" } } },
    },
    "/team/members/{id}": {
      put: { tags: ["Team"], summary: "Update team member", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated member" } } },
      delete: { tags: ["Team"], summary: "Remove team member", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Removed" } } },
    },
    "/team/departments": {
      get: { tags: ["Team"], summary: "List departments", responses: { "200": { description: "Department list" } } },
      post: { tags: ["Team"], summary: "Create department", responses: { "201": { description: "Created department" } } },
    },
    "/admin/users": {
      get: { tags: ["Admin"], summary: "List admin users", responses: { "200": { description: "Admin user list" } } },
      post: { tags: ["Admin"], summary: "Create admin user", responses: { "201": { description: "Created admin user" } } },
    },
    "/admin/users/{id}": {
      put: { tags: ["Admin"], summary: "Update admin user", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Admin"], summary: "Delete admin user", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/admin/api-keys": {
      get: { tags: ["Admin"], summary: "List API keys", responses: { "200": { description: "API key list" } } },
      post: { tags: ["Admin"], summary: "Create API key", responses: { "201": { description: "Created API key" } } },
    },
    "/admin/api-keys/{id}": {
      delete: { tags: ["Admin"], summary: "Revoke API key", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Revoked" } } },
    },
    "/realtime": {
      get: { tags: ["System"], summary: "Server-Sent Events stream for real-time updates", security: [], responses: { "200": { description: "SSE stream with event types: message, conversation, ticket, notification, customer, activity" } } },
    },
    "/activity": {
      get: { tags: ["System"], summary: "Recent activity feed", responses: { "200": { description: "Recent activity entries" } } },
    },
    "/business-hours": {
      get: { tags: ["Settings"], summary: "Get business hours configuration", responses: { "200": { description: "Business hours config" } } },
      put: { tags: ["Settings"], summary: "Update business hours", responses: { "200": { description: "Updated business hours" } } },
    },
    "/canned-responses": {
      get: { tags: ["Settings"], summary: "List canned responses", responses: { "200": { description: "Canned response list" } } },
      post: { tags: ["Settings"], summary: "Create canned response", responses: { "201": { description: "Created" } } },
    },
    "/canned-responses/{id}": {
      put: { tags: ["Settings"], summary: "Update canned response", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Settings"], summary: "Delete canned response", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/sla": {
      get: { tags: ["Settings"], summary: "List SLA policies", responses: { "200": { description: "SLA policy list" } } },
      post: { tags: ["Settings"], summary: "Create SLA policy", responses: { "201": { description: "Created" } } },
    },
    "/sla/{id}": {
      put: { tags: ["Settings"], summary: "Update SLA policy", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Settings"], summary: "Delete SLA policy", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/flows": {
      get: { tags: ["Automation"], summary: "List visual flows", responses: { "200": { description: "Flow list" } } },
      post: { tags: ["Automation"], summary: "Create visual flow", responses: { "201": { description: "Created flow" } } },
    },
    "/flows/{id}": {
      get: { tags: ["Automation"], summary: "Get flow details", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Flow details" } } },
      put: { tags: ["Automation"], summary: "Update flow", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Automation"], summary: "Delete flow", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/flows/{id}/validate": {
      post: { tags: ["Automation"], summary: "Validate a flow definition", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Validation result" } } },
    },
    "/campaigns": {
      get: { tags: ["Customers"], summary: "List campaigns", responses: { "200": { description: "Campaign list" } } },
      post: { tags: ["Customers"], summary: "Create campaign", responses: { "201": { description: "Created" } } },
    },
    "/campaigns/{id}": {
      get: { tags: ["Customers"], summary: "Get campaign details", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Campaign details" } } },
      put: { tags: ["Customers"], summary: "Update campaign", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Customers"], summary: "Delete campaign", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/campaigns/{id}/execute": {
      post: { tags: ["Customers"], summary: "Execute a campaign", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Execution started" } } },
    },
    "/conversations/{id}/notes": {
      get: { tags: ["Conversations"], summary: "List conversation notes", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Note list" } } },
      post: { tags: ["Conversations"], summary: "Add a note to a conversation", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "201": { description: "Created note" } } },
    },
    "/conversations/{id}/transfer": {
      post: { tags: ["Conversations"], summary: "Transfer conversation to another agent or department", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Transfer result" } } },
    },
    "/conversations/{id}/snooze": {
      post: { tags: ["Conversations"], summary: "Snooze a conversation", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Snoozed" } } },
    },
    "/conversations/{id}/merge": {
      post: { tags: ["Conversations"], summary: "Merge conversations", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Merged" } } },
    },
    "/conversations/{id}/satisfaction": {
      get: { tags: ["Conversations"], summary: "Get satisfaction rating", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Satisfaction rating" } } },
    },
    "/customers/{id}/gdpr/export": {
      get: { tags: ["Customers"], summary: "Export customer data (GDPR)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Customer data export" } } },
    },
    "/customers/{id}/gdpr/delete": {
      delete: { tags: ["Customers"], summary: "Delete customer data (GDPR)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
    },
    "/assets/upload": {
      post: { tags: ["System"], summary: "Upload an asset (logo, favicon, attachment)", requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } } }, responses: { "200": { description: "Upload result with URL" } } },
    },
    "/ai/models": {
      get: { tags: ["Settings"], summary: "List available AI models for the configured provider", responses: { "200": { description: "Model list" } } },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "owly-token" },
    },
    schemas: {
      PaginatedResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: {} },
          pagination: {
            type: "object",
            properties: {
              page: { type: "integer" },
              limit: { type: "integer" },
              total: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              requestId: { type: "string" },
              details: {},
            },
          },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }],
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

import { describe, it, expect } from "vitest";
import {
  validateBody,
  loginSchema,
  setupSchema,
  createConversationSchema,
  createTicketSchema,
  createWebhookSchema,
  createAutomationRuleSchema,
  updateSettingsSchema,
  createCustomerSchema,
  createTeamMemberSchema,
} from "@/lib/validations";

describe("Input Validation Schemas", () => {
  describe("loginSchema", () => {
    it("should accept valid login", () => {
      const result = validateBody(loginSchema, {
        action: "login",
        username: "admin",
        password: "pass123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty username", () => {
      const result = validateBody(loginSchema, {
        action: "login",
        username: "",
        password: "pass123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing password", () => {
      const result = validateBody(loginSchema, {
        action: "login",
        username: "admin",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("setupSchema", () => {
    it("should accept valid setup", () => {
      const result = validateBody(setupSchema, {
        action: "setup",
        username: "admin",
        password: "secure123",
        name: "Admin User",
      });
      expect(result.success).toBe(true);
    });

    it("should reject short username", () => {
      const result = validateBody(setupSchema, {
        action: "setup",
        username: "ab",
        password: "secure123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject short password", () => {
      const result = validateBody(setupSchema, {
        action: "setup",
        username: "admin",
        password: "12345",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createConversationSchema", () => {
    it("should accept valid conversation", () => {
      const result = validateBody(createConversationSchema, {
        channel: "whatsapp",
        customerName: "John",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing channel", () => {
      const result = validateBody(createConversationSchema, {
        customerName: "John",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid status", () => {
      const result = validateBody(createConversationSchema, {
        channel: "email",
        status: "invalid_status",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createTicketSchema", () => {
    it("should accept valid ticket", () => {
      const result = validateBody(createTicketSchema, {
        title: "Bug report",
        description: "Something is broken",
        priority: "high",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty title", () => {
      const result = validateBody(createTicketSchema, {
        title: "",
        description: "Details",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid priority", () => {
      const result = validateBody(createTicketSchema, {
        title: "Bug",
        priority: "super-critical",
      });
      expect(result.success).toBe(false);
    });

    it("should apply defaults for optional fields", () => {
      const result = validateBody(createTicketSchema, { title: "Bug" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe("medium");
        expect(result.data.status).toBe("open");
      }
    });
  });

  describe("createWebhookSchema", () => {
    it("should accept valid webhook", () => {
      const result = validateBody(createWebhookSchema, {
        name: "Slack Alert",
        url: "https://hooks.slack.com/services/xxx",
        triggerOn: "ticket_created",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid URL", () => {
      const result = validateBody(createWebhookSchema, {
        name: "Bad Hook",
        url: "not-a-url",
        triggerOn: "ticket_created",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid HTTP method", () => {
      const result = validateBody(createWebhookSchema, {
        name: "Hook",
        url: "https://example.com",
        method: "INVALID",
        triggerOn: "event",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createAutomationRuleSchema", () => {
    it("should accept valid rule", () => {
      const result = validateBody(createAutomationRuleSchema, {
        name: "Route billing",
        type: "auto_route",
        conditions: [
          { field: "message_content", operator: "contains", value: "billing" },
        ],
        actions: [{ type: "route", value: "billing-dept" }],
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty conditions", () => {
      const result = validateBody(createAutomationRuleSchema, {
        name: "Bad Rule",
        type: "auto_route",
        conditions: [],
        actions: [{ type: "route", value: "dept" }],
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid condition field", () => {
      const result = validateBody(createAutomationRuleSchema, {
        name: "Bad Rule",
        type: "auto_route",
        conditions: [
          { field: "invalid_field", operator: "contains", value: "test" },
        ],
        actions: [{ type: "route", value: "dept" }],
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid type", () => {
      const result = validateBody(createAutomationRuleSchema, {
        name: "Bad Rule",
        type: "invalid_type",
        conditions: [
          { field: "channel", operator: "equals", value: "email" },
        ],
        actions: [{ type: "tag", value: "urgent" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateSettingsSchema", () => {
    it("should accept valid partial update", () => {
      const result = validateBody(updateSettingsSchema, {
        businessName: "New Name",
        tone: "formal",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid tone", () => {
      const result = validateBody(updateSettingsSchema, {
        tone: "super-casual",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid temperature", () => {
      const result = validateBody(updateSettingsSchema, {
        temperature: 5.0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject unknown fields (strict mode)", () => {
      const result = validateBody(updateSettingsSchema, {
        businessName: "Test",
        unknownField: "value",
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid themeOverridesLight with hex colors", () => {
      const result = validateBody(updateSettingsSchema, {
        themeOverridesLight: { "--owly-primary": "#FF6B00" },
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid themeOverridesDark with hex colors", () => {
      const result = validateBody(updateSettingsSchema, {
        themeOverridesDark: { "--owly-bg": "#0f1117", "--owly-primary": "#FF6B00" },
      });
      expect(result.success).toBe(true);
    });

    it("should accept rgb/hsl color values in theme overrides", () => {
      const result = validateBody(updateSettingsSchema, {
        themeOverridesLight: { "--owly-primary": "rgb(255, 107, 0)" },
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid color values in themeOverridesLight", () => {
      const result = validateBody(updateSettingsSchema, {
        themeOverridesLight: { "--owly-primary": "javascript:alert(1)" },
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid color values in themeOverridesDark", () => {
      const result = validateBody(updateSettingsSchema, {
        themeOverridesDark: { "--owly-bg": "not-a-color" },
      });
      expect(result.success).toBe(false);
    });

    it("should reject old themeOverrides field (removed)", () => {
      const result = validateBody(updateSettingsSchema, {
        themeOverrides: { "--owly-primary": "#FF6B00" },
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid theme logo URL with relative path", () => {
      const result = validateBody(updateSettingsSchema, {
        themeLogoUrl: "/uploads/logo.png",
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid theme logo URL with https", () => {
      const result = validateBody(updateSettingsSchema, {
        themeLogoUrl: "https://example.com/logo.png",
      });
      expect(result.success).toBe(true);
    });

    it("should reject javascript: scheme in logo URL", () => {
      const result = validateBody(updateSettingsSchema, {
        themeLogoUrl: "javascript:alert(1)",
      });
      expect(result.success).toBe(false);
    });

    it("should reject data: scheme in favicon URL", () => {
      const result = validateBody(updateSettingsSchema, {
        themeFaviconUrl: "data:text/html,<script>alert(1)</script>",
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid themePreset", () => {
      const result = validateBody(updateSettingsSchema, {
        themePreset: "mono",
      });
      expect(result.success).toBe(true);
    });

    it("should accept appName and appNameShort", () => {
      const result = validateBody(updateSettingsSchema, {
        appName: "PowerDeck Help Desk",
        appNameShort: "PowerDeck",
      });
      expect(result.success).toBe(true);
    });

    it("should reject appName exceeding 100 chars", () => {
      const result = validateBody(updateSettingsSchema, {
        appName: "x".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("should reject appNameShort exceeding 50 chars", () => {
      const result = validateBody(updateSettingsSchema, {
        appNameShort: "x".repeat(51),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createCustomerSchema", () => {
    it("should accept valid customer", () => {
      const result = validateBody(createCustomerSchema, {
        name: "John Doe",
        email: "john@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = validateBody(createCustomerSchema, {
        name: "John",
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createTeamMemberSchema", () => {
    it("should accept valid team member", () => {
      const result = validateBody(createTeamMemberSchema, {
        name: "Jane Smith",
        email: "jane@company.com",
        departmentId: "dept-1",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing department", () => {
      const result = validateBody(createTeamMemberSchema, {
        name: "Jane",
        email: "jane@company.com",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("XSS payloads should be treated as normal strings", () => {
    it("should accept XSS in title (validation passes, escaping happens at render)", () => {
      const result = validateBody(createTicketSchema, {
        title: '<script>alert("xss")</script>',
      });
      expect(result.success).toBe(true);
    });

    it("should accept long strings within limits", () => {
      const result = validateBody(createTicketSchema, {
        title: "A".repeat(500),
      });
      expect(result.success).toBe(true);
    });

    it("should reject strings exceeding max length", () => {
      const result = validateBody(createTicketSchema, {
        title: "A".repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });
});

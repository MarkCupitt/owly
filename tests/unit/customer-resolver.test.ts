import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveCustomer, normalizePhone } from "@/lib/customer-resolver";

describe("normalizePhone", () => {
  it("strips WhatsApp suffixes", () => {
    expect(normalizePhone("639765247811@c.us")).toBe("639765247811");
    expect(normalizePhone("639765247811@s.whatsapp.net")).toBe("639765247811");
  });

  it("strips non-digit chars except leading +", () => {
    expect(normalizePhone("+63 976 524 7811")).toBe("+639765247811");
    expect(normalizePhone("(63) 976-524-7811")).toBe("639765247811");
  });

  it("removes + from non-leading positions", () => {
    expect(normalizePhone("63+976+524+7811")).toBe("639765247811");
  });
});

describe("resolveCustomer — cross-channel matching", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.create as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.update as ReturnType<typeof vi.fn>).mockReset();
  });

  describe("Step 1: Channel-specific ID match", () => {
    it("matches messenger customer by facebookId", async () => {
      const existing = {
        id: "cust-fb-1", name: "Jane Doe", email: "", phone: "", whatsapp: "",
        facebookId: "fb_123", instagramId: "",
      };
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const result = await resolveCustomer("messenger", "fb_123", "Jane Doe");

      expect(result).toBe("cust-fb-1");
      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { facebookId: "fb_123" },
      });
    });

    it("matches instagram customer by instagramId", async () => {
      const existing = {
        id: "cust-ig-1", name: "John Smith", email: "", phone: "", whatsapp: "",
        facebookId: "", instagramId: "ig_456",
      };
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const result = await resolveCustomer("instagram", "ig_456", "John Smith");

      expect(result).toBe("cust-ig-1");
      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { instagramId: "ig_456" },
      });
    });

    it("matches email customer by email (case-insensitive)", async () => {
      const existing = {
        id: "cust-email-1", name: "Mark", email: "mark@example.com", phone: "", whatsapp: "",
        facebookId: "", instagramId: "",
      };
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const result = await resolveCustomer("email", "Mark@Example.COM", "Mark");

      expect(result).toBe("cust-email-1");
    });
  });

  describe("Step 2: Email match (cross-channel)", () => {
    it("matches existing email customer when messenger message includes sender_email", async () => {
      const existing = {
        id: "cust-email-1", name: "Mark Cupitt", email: "mark@example.com", phone: "", whatsapp: "",
        facebookId: "", instagramId: "",
      };
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);

      (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const result = await resolveCustomer("messenger", "fb_789", "Mark Cupitt", {
        senderEmail: "mark@example.com",
      });

      expect(result).toBe("cust-email-1");
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: "cust-email-1" },
        data: expect.objectContaining({
          facebookId: "fb_789",
          lastContact: expect.any(Date),
        }),
      });
    });

    it("does not match when senderEmail is a Facebook proxy email that doesn't exist in DB", async () => {
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      (prisma.customer.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "cust-new-1",
      });

      const result = await resolveCustomer("messenger", "fb_999", "Unknown", {
        senderEmail: "12345@facebook.com",
      });

      expect(result).toBe("cust-new-1");
      expect(prisma.customer.create).toHaveBeenCalled();
    });
  });

  describe("Step 3: Phone match (cross-channel)", () => {
    it("matches existing phone customer when messenger message includes sender_phone", async () => {
      const existing = {
        id: "cust-phone-1", name: "Jane", email: "", phone: "+639765247811", whatsapp: "",
        facebookId: "", instagramId: "",
      };
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);

      (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const result = await resolveCustomer("messenger", "fb_111", "Jane", {
        senderPhone: "+63 976 524 7811",
      });

      expect(result).toBe("cust-phone-1");
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: "cust-phone-1" },
        data: expect.objectContaining({
          facebookId: "fb_111",
        }),
      });
    });
  });

  describe("Step 4: Cross-field fallback", () => {
    it("matches when customerContact exists in any contact field", async () => {
      const existing = {
        id: "cust-x-1", name: "Existing", email: "", phone: "", whatsapp: "",
        facebookId: "", instagramId: "",
      };
      // For a custom channel with no senderEmail/senderPhone:
      // Step 1 (findByChannelField) → default case → null (no findFirst call)
      // Step 2 (email) → skipped (no senderEmail)
      // Step 3 (phone) → skipped (no senderPhone)
      // Step 4 (cross-field) → findFirst with OR query
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const result = await resolveCustomer("custom_channel", "some_contact_id", "Existing");

      expect(result).toBe("cust-x-1");
    });
  });

  describe("Step 5: Auto-create new customer", () => {
    it("creates customer with all available identifiers", async () => {
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      (prisma.customer.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "cust-new-1",
      });

      const result = await resolveCustomer("messenger", "fb_new", "New User", {
        senderEmail: "new@example.com",
        senderPhone: "+639765247811",
      });

      expect(result).toBe("cust-new-1");
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "New User",
          facebookId: "fb_new",
          email: "new@example.com",
          phone: "+639765247811",
          firstContact: expect.any(Date),
          lastContact: expect.any(Date),
        }),
      });
    });

    it("creates customer with instagramId for instagram channel", async () => {
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      (prisma.customer.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "cust-ig-new",
      });

      const result = await resolveCustomer("instagram", "ig_new", "IG User");

      expect(result).toBe("cust-ig-new");
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "IG User",
          instagramId: "ig_new",
        }),
      });
    });
  });

  describe("Backfill behavior", () => {
    it("backfills email and facebookId when customer matched by phone", async () => {
      const existing = {
        id: "cust-1", name: "Jane", email: "", phone: "+639765247811", whatsapp: "",
        facebookId: "", instagramId: "",
      };
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);

      (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      await resolveCustomer("messenger", "fb_backfill", "Jane", {
        senderEmail: "jane@example.com",
        senderPhone: "+639765247811",
      });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: "cust-1" },
        data: expect.objectContaining({
          facebookId: "fb_backfill",
          email: "jane@example.com",
        }),
      });
    });

    it("does not overwrite existing email when backfilling", async () => {
      const existing = {
        id: "cust-1", name: "Jane", email: "jane@existing.com", phone: "", whatsapp: "",
        facebookId: "", instagramId: "",
      };
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);

      (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      await resolveCustomer("messenger", "fb_new", "Jane", {
        senderEmail: "jane@different.com",
      });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: "cust-1" },
        data: expect.not.objectContaining({
          email: "jane@different.com",
        }),
      });
    });

    it("updates name from Unknown to real name", async () => {
      const existing = {
        id: "cust-1", name: "Unknown", email: "mark@example.com", phone: "", whatsapp: "",
        facebookId: "", instagramId: "",
      };
      (prisma.customer.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);

      (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      await resolveCustomer("messenger", "fb_123", "Mark Cupitt", {
        senderEmail: "mark@example.com",
      });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: "cust-1" },
        data: expect.objectContaining({
          name: "Mark Cupitt",
          facebookId: "fb_123",
        }),
      });
    });
  });

  describe("Empty contact handling", () => {
    it("creates customer with just name when no contact info", async () => {
      (prisma.customer.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "cust-anon",
      });

      const result = await resolveCustomer("messenger", "", "Anonymous User");

      expect(result).toBe("cust-anon");
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Anonymous User",
        }),
      });
    });
  });
});

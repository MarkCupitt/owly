import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveCustomer, normalizePhone } from "@/lib/customer-resolver";
import { isFakeEmail } from "@/lib/fake-email";

// Mock fake-email
vi.mock("@/lib/fake-email", () => ({
  isFakeEmail: vi.fn().mockResolvedValue(false),
  isFakeEmailSync: vi.fn().mockReturnValue(false),
  extractEmail: vi.fn((text: string) => {
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
  }),
}));

describe("resolveCustomer — CustomerChannelLink matching", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.create as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.update as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerChannelLink.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerChannelLink.create as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerChannelLink.upsert as ReturnType<typeof vi.fn>).mockReset();
    (isFakeEmail as ReturnType<typeof vi.fn>).mockResolvedValue(false);
  });

  it("matches via CustomerChannelLink first (channel-agnostic)", async () => {
    const existing = {
      id: "cust-1",
      customerId: "cust-1",
      customer: { id: "cust-1", name: "Jane", email: "", phone: "", whatsapp: "", facebookId: "", instagramId: "", externalId: "", externalSystem: "", profilePicUrl: "" },
    };
    (prisma.customerChannelLink.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing.customer);

    const result = await resolveCustomer("custom_channel", "ext_id_123", "Jane");

    expect(result).toBe("cust-1");
    expect(prisma.customerChannelLink.findUnique).toHaveBeenCalledWith({
      where: { channel_externalId: { channel: "custom_channel", externalId: "ext_id_123" } },
      include: { customer: true },
    });
  });

  it("falls through to legacy matching when no channel link found", async () => {
    (prisma.customerChannelLink.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const existing = {
      id: "cust-fb-1", name: "Jane Doe", email: "", phone: "", whatsapp: "",
      facebookId: "fb_123", instagramId: "", externalId: "", externalSystem: "", profilePicUrl: "",
    };
    (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (prisma.customerChannelLink.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await resolveCustomer("messenger", "fb_123", "Jane Doe");

    expect(result).toBe("cust-fb-1");
    // Should backfill channel link
    expect(prisma.customerChannelLink.upsert).toHaveBeenCalled();
  });
});

describe("resolveCustomer — fake email filtering", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.create as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.update as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerChannelLink.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerChannelLink.create as ReturnType<typeof vi.fn>).mockReset();
    (isFakeEmail as ReturnType<typeof vi.fn>).mockReset();
  });

  it("filters fake emails and does not match by them", async () => {
    (isFakeEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (prisma.customerChannelLink.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.customer.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "cust-new" });
    (prisma.customerChannelLink.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await resolveCustomer("messenger", "fb_999", "Unknown", {
      senderEmail: "12345@facebook.com",
    });

    expect(result).toBe("cust-new");
    // Should NOT have tried to match by email since it's fake
    expect(prisma.customer.create).toHaveBeenCalled();
    // The create data should NOT contain the fake email
    const createCall = (prisma.customer.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createCall.data.email).toBeUndefined();
  });
});

describe("resolveCustomer — external ID matching", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.create as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.update as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerChannelLink.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerChannelLink.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("matches by externalId + externalSystem", async () => {
    (prisma.customerChannelLink.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.customer.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null) // legacy channel match
      .mockResolvedValueOnce({ id: "cust-ext-1", name: "John", email: "", phone: "", whatsapp: "", facebookId: "", instagramId: "", externalId: "ext-123", externalSystem: "powerdeck", profilePicUrl: "" });
    (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cust-ext-1", name: "John", email: "", phone: "", whatsapp: "", facebookId: "", instagramId: "", externalId: "ext-123", externalSystem: "powerdeck", profilePicUrl: "",
    });

    const result = await resolveCustomer("widget", "widget_user_1", "John", {
      externalId: "ext-123",
      externalSystem: "powerdeck",
    });

    expect(result).toBe("cust-ext-1");
  });
});

describe("resolveCustomer — race condition handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.create as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.update as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerChannelLink.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerChannelLink.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("falls back to find when create hits unique constraint violation", async () => {
    (prisma.customerChannelLink.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.customer.create as ReturnType<typeof vi.fn>).mockRejectedValue({ code: "P2002" });
    (prisma.customer.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "cust-existing" });
    (prisma.customerChannelLink.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.customerChannelLink.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await resolveCustomer("email", "john@example.com", "John");

    expect(result).toBe("cust-existing");
  });
});

describe("resolveCustomer — channel link creation on new customer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.create as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.update as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerChannelLink.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerChannelLink.create as ReturnType<typeof vi.fn>).mockReset();
  });

  it("creates channel link when creating a new customer", async () => {
    (prisma.customerChannelLink.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.customer.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "cust-new-1" });
    (prisma.customerChannelLink.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await resolveCustomer("messenger", "fb_new", "New User");

    expect(result).toBe("cust-new-1");
    expect(prisma.customerChannelLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: "cust-new-1",
        channel: "messenger",
        externalId: "fb_new",
      }),
    });
  });
});

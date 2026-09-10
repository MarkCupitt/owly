import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { lookupUpstreamUser, linkUpstreamIdentity } from "@/lib/upstream-identity";

// Mock global fetch
global.fetch = vi.fn() as any;

describe("upstream-identity", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (prisma.settings.findFirst as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customer.update as ReturnType<typeof vi.fn>).mockReset();
    (global.fetch as any).mockReset();
  });

  describe("lookupUpstreamUser", () => {
    it("returns null when upstream identity is disabled", async () => {
      (prisma.settings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        upstreamIdentityEnabled: false,
      });

      const result = await lookupUpstreamUser("user@example.com");
      expect(result).toBeNull();
    });

    it("returns null on 404 response", async () => {
      (prisma.settings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        upstreamIdentityEnabled: true,
        upstreamIdentityUrl: "https://upstream.example.com/users?email={email}",
        upstreamIdentityApiKey: "key123",
        upstreamIdentityApiKeyHeader: "Authorization",
        upstreamIdentityApiKeyPrefix: "Bearer ",
        upstreamIdentityResponseUserIdField: "user_id",
        upstreamIdentityResponseNameField: "display_name",
        upstreamIdentityResponseFirstNameField: "first_name",
        upstreamIdentityResponseLastNameField: "last_name",
        upstreamIdentityResponsePhotoField: "photo_url",
      });
      (global.fetch as any).mockResolvedValue({
        status: 404,
        ok: false,
      });

      const result = await lookupUpstreamUser("notfound@example.com");
      expect(result).toBeNull();
    });

    it("parses user from successful response", async () => {
      (prisma.settings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        upstreamIdentityEnabled: true,
        upstreamIdentityUrl: "https://upstream.example.com/users?email={email}",
        upstreamIdentityApiKey: "key123",
        upstreamIdentityApiKeyHeader: "Authorization",
        upstreamIdentityApiKeyPrefix: "Bearer ",
        upstreamIdentityResponseUserIdField: "user_id",
        upstreamIdentityResponseNameField: "display_name",
        upstreamIdentityResponseFirstNameField: "first_name",
        upstreamIdentityResponseLastNameField: "last_name",
        upstreamIdentityResponsePhotoField: "photo_url",
      });
      (global.fetch as any).mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          user_id: "ext-123",
          display_name: "John Doe",
          first_name: "John",
          last_name: "Doe",
          photo_url: "https://example.com/photo.jpg",
        }),
      });

      const result = await lookupUpstreamUser("john@example.com");

      expect(result).toEqual({
        userId: "ext-123",
        displayName: "John Doe",
        firstName: "John",
        lastName: "Doe",
        photoUrl: "https://example.com/photo.jpg",
      });
    });

    it("sends API key in correct header", async () => {
      (prisma.settings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        upstreamIdentityEnabled: true,
        upstreamIdentityUrl: "https://upstream.example.com/users?email={email}",
        upstreamIdentityApiKey: "secret-key",
        upstreamIdentityApiKeyHeader: "X-API-Key",
        upstreamIdentityApiKeyPrefix: "Token ",
        upstreamIdentityResponseUserIdField: "user_id",
        upstreamIdentityResponseNameField: "display_name",
        upstreamIdentityResponseFirstNameField: "first_name",
        upstreamIdentityResponseLastNameField: "last_name",
        upstreamIdentityResponsePhotoField: "photo_url",
      });
      (global.fetch as any).mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ user_id: "ext-1", display_name: "Test", first_name: "", last_name: "", photo_url: "" }),
      });

      await lookupUpstreamUser("test@example.com");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://upstream.example.com/users?email=test%40example.com",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": "Token secret-key",
          }),
        })
      );
    });
  });

  describe("linkUpstreamIdentity", () => {
    it("returns found:false when upstream identity is disabled", async () => {
      (prisma.settings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        upstreamIdentityEnabled: false,
      });

      const result = await linkUpstreamIdentity("cust-1", "user@example.com");
      expect(result).toEqual({ found: false });
    });

    it("returns found:false when customer already has externalId", async () => {
      (prisma.settings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        upstreamIdentityEnabled: true,
        upstreamIdentitySystemLabel: "powerdeck",
      });
      (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        externalId: "existing-id",
        name: "John",
      });

      const result = await linkUpstreamIdentity("cust-1", "user@example.com");
      expect(result).toEqual({ found: false });
    });

    it("links upstream identity when user is found", async () => {
      (prisma.settings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        upstreamIdentityEnabled: true,
        upstreamIdentityUrl: "https://upstream.example.com/users?email={email}",
        upstreamIdentityApiKey: "key",
        upstreamIdentityApiKeyHeader: "Authorization",
        upstreamIdentityApiKeyPrefix: "Bearer ",
        upstreamIdentitySystemLabel: "powerdeck",
        upstreamIdentityResponseUserIdField: "user_id",
        upstreamIdentityResponseNameField: "display_name",
        upstreamIdentityResponseFirstNameField: "first_name",
        upstreamIdentityResponseLastNameField: "last_name",
        upstreamIdentityResponsePhotoField: "photo_url",
      });
      (prisma.customer.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        externalId: "",
        name: "Unknown",
      });
      (global.fetch as any).mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          user_id: "pd-123",
          display_name: "John Doe",
          first_name: "John",
          last_name: "Doe",
          photo_url: "https://example.com/photo.jpg",
        }),
      });
      (prisma.customer.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await linkUpstreamIdentity("cust-1", "john@example.com");

      expect(result.found).toBe(true);
      expect(result.user?.userId).toBe("pd-123");
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: "cust-1" },
        data: expect.objectContaining({
          externalId: "pd-123",
          externalSystem: "powerdeck",
          profilePicUrl: "https://example.com/photo.jpg",
          name: "John Doe",
        }),
      });
    });
  });
});

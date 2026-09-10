import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { findNameMatches, createMatchProposal, checkAndProposeMatches } from "@/lib/customer-matcher";

describe("customer-matcher", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (prisma.customer.findMany as ReturnType<typeof vi.fn>).mockReset();
    (prisma.customerMatchProposal.create as ReturnType<typeof vi.fn>).mockReset();
  });

  describe("findNameMatches", () => {
    it("returns empty for Unknown name", async () => {
      const result = await findNameMatches("Unknown", "cust-1");
      expect(result).toEqual([]);
    });

    it("returns empty for empty name", async () => {
      const result = await findNameMatches("", "cust-1");
      expect(result).toEqual([]);
    });

    it("returns empty for very short names", async () => {
      const result = await findNameMatches("Jo", "cust-1");
      expect(result).toEqual([]);
    });

    it("finds exact name matches (case-insensitive)", async () => {
      (prisma.customer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "cust-2", name: "John Doe", email: "john@example.com" },
      ]);

      const result = await findNameMatches("john doe", "cust-1");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "cust-2",
        matchType: "name_exact",
        confidence: "high",
      });
    });

    it("finds fuzzy name matches (small typo)", async () => {
      (prisma.customer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "cust-2", name: "John Doe", email: "john@example.com" },
      ]);

      const result = await findNameMatches("Jon Doe", "cust-1");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "cust-2",
        matchType: "name_fuzzy",
        confidence: "medium",
      });
    });

    it("does not match very different names", async () => {
      (prisma.customer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "cust-2", name: "Completely Different", email: "other@example.com" },
      ]);

      const result = await findNameMatches("John Doe", "cust-1");

      expect(result).toEqual([]);
    });
  });

  describe("createMatchProposal", () => {
    it("creates a proposal in the database", async () => {
      (prisma.customerMatchProposal.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await createMatchProposal("cust-1", "cust-2", "name_exact", "high");

      expect(prisma.customerMatchProposal.create).toHaveBeenCalledWith({
        data: { customerId: "cust-1", proposedMatchId: "cust-2", matchType: "name_exact", confidence: "high" },
      });
    });

    it("does not throw on DB error", async () => {
      (prisma.customerMatchProposal.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));

      await expect(createMatchProposal("cust-1", "cust-2", "name_exact", "high")).resolves.not.toThrow();
    });
  });

  describe("checkAndProposeMatches", () => {
    it("creates proposals for all matches found", async () => {
      (prisma.customer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "cust-2", name: "John Doe", email: "john@example.com" },
        { id: "cust-3", name: "Jon Doe", email: "jon@example.com" },
      ]);
      (prisma.customerMatchProposal.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await checkAndProposeMatches("cust-1", "John Doe");

      expect(prisma.customerMatchProposal.create).toHaveBeenCalledTimes(2);
    });
  });
});

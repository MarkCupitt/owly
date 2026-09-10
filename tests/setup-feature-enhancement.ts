import { vi } from "vitest";

// Mock fake-email module
vi.mock("@/lib/fake-email", () => ({
  isFakeEmail: vi.fn().mockResolvedValue(false),
  isFakeEmailSync: vi.fn().mockReturnValue(false),
  extractEmail: vi.fn((text: string) => {
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
  }),
}));

// Mock upstream-identity to prevent real fetch calls
vi.mock("@/lib/upstream-identity", () => ({
  lookupUpstreamUser: vi.fn().mockResolvedValue(null),
  linkUpstreamIdentity: vi.fn().mockResolvedValue({ found: false }),
}));

// Mock customer-matcher to prevent DB calls
vi.mock("@/lib/customer-matcher", () => ({
  findNameMatches: vi.fn().mockResolvedValue([]),
  createMatchProposal: vi.fn().mockResolvedValue(undefined),
  checkAndProposeMatches: vi.fn().mockResolvedValue(undefined),
}));

// Mock notifications to prevent DB calls
vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  getUnreadCount: vi.fn().mockResolvedValue(0),
}));

// Mock automation to prevent DB calls
vi.mock("@/lib/automation", () => ({
  evaluateRules: vi.fn().mockResolvedValue([]),
}));

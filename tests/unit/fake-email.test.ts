import { describe, it, expect } from "vitest";
import { isFakeEmailSync, extractEmail } from "@/lib/fake-email";

describe("isFakeEmailSync", () => {
  it("returns true for facebook.com proxy emails", () => {
    expect(isFakeEmailSync("12345@facebook.com", ["facebook.com"])).toBe(true);
  });

  it("returns false for real emails", () => {
    expect(isFakeEmailSync("user@example.com", ["facebook.com"])).toBe(false);
    expect(isFakeEmailSync("mark@coolabah.com", ["facebook.com"])).toBe(false);
  });

  it("handles case-insensitive domain matching", () => {
    expect(isFakeEmailSync("user@FACEBOOK.COM", ["facebook.com"])).toBe(true);
  });

  it("returns false for emails without @", () => {
    expect(isFakeEmailSync("notanemail", ["facebook.com"])).toBe(false);
  });

  it("handles multiple fake domains", () => {
    expect(isFakeEmailSync("user@facebook.com", ["facebook.com", "example.org"])).toBe(true);
    expect(isFakeEmailSync("user@example.org", ["facebook.com", "example.org"])).toBe(true);
    expect(isFakeEmailSync("user@real.com", ["facebook.com", "example.org"])).toBe(false);
  });
});

describe("extractEmail", () => {
  it("extracts email from simple text", () => {
    expect(extractEmail("My email is user@example.com")).toBe("user@example.com");
  });

  it("extracts email from complex text", () => {
    expect(extractEmail("Please contact john.doe+test@sub.example.co.uk for help")).toBe(
      "john.doe+test@sub.example.co.uk"
    );
  });

  it("returns null when no email present", () => {
    expect(extractEmail("No email here")).toBeNull();
  });

  it("extracts first email when multiple present", () => {
    expect(extractEmail("first@a.com and second@b.com")).toBe("first@a.com");
  });

  it("handles empty string", () => {
    expect(extractEmail("")).toBeNull();
  });
});

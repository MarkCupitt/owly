import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs before importing the route
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

describe("POST /api/assets/upload", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should reject request without file", async () => {
    const { POST } = await import("@/app/api/assets/upload/route");
    const formData = new FormData();
    const request = new Request("http://localhost/api/assets/upload", {
      method: "POST",
      body: formData,
    });
    const response = await POST(request as any);
    expect(response.status).toBe(400);
  });

  it("should reject non-image file type", async () => {
    const { POST } = await import("@/app/api/assets/upload/route");
    const formData = new FormData();
    const file = new File(["text content"], "test.txt", { type: "text/plain" });
    formData.append("file", file);
    const request = new Request("http://localhost/api/assets/upload", {
      method: "POST",
      body: formData,
    });
    const response = await POST(request as any);
    expect(response.status).toBe(400);
  });

  it("should reject file exceeding size limit", async () => {
    const { POST } = await import("@/app/api/assets/upload/route");
    const formData = new FormData();
    const largeContent = new Uint8Array(3 * 1024 * 1024);
    const file = new File([largeContent], "big.png", { type: "image/png" });
    formData.append("file", file);
    const request = new Request("http://localhost/api/assets/upload", {
      method: "POST",
      body: formData,
    });
    const response = await POST(request as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("large");
  });

  it("should accept valid image upload and return path", async () => {
    const { POST } = await import("@/app/api/assets/upload/route");
    const formData = new FormData();
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "logo.png", {
      type: "image/png",
    });
    formData.append("file", file);
    const request = new Request("http://localhost/api/assets/upload", {
      method: "POST",
      body: formData,
    });
    const response = await POST(request as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.path).toMatch(/^\/uploads\//);
    expect(data.path).toContain(".png");
  });
});

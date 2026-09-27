import { describe, expect, it } from "vitest";
import {
  isStorageKey,
  buildPhotoKey,
  isAllowedPhotoMime,
  mimeToExt,
} from "../src/lib/photo-url";

describe("isStorageKey", () => {
  it("treats non-http values as bucket keys", () => {
    expect(isStorageKey("products/abc.jpg")).toBe(true);
    expect(isStorageKey("https://example.com/x.jpg")).toBe(false);
    expect(isStorageKey("http://example.com/x.jpg")).toBe(false);
    expect(isStorageKey("/local/path.png")).toBe(false);
    expect(isStorageKey(null)).toBe(false);
    expect(isStorageKey("")).toBe(false);
  });
});

describe("buildPhotoKey", () => {
  it("builds products/<id>.<ext>", () => {
    const id = "9a1b2c3d-0000-4000-8000-000000000000";
    expect(buildPhotoKey(id, ".jpg")).toBe(`products/${id}.jpg`);
    expect(buildPhotoKey(id, "PNG")).toBe(`products/${id}.png`);
  });

  it("rejects unknown extensions", () => {
    expect(buildPhotoKey("x", ".gif")).toBeNull();
    expect(buildPhotoKey("x", "../etc/passwd")).toBeNull();
  });
});

describe("mime validation", () => {
  it("allows only photo mimes", () => {
    expect(isAllowedPhotoMime("image/jpeg")).toBe(true);
    expect(isAllowedPhotoMime("image/webp")).toBe(true);
    expect(isAllowedPhotoMime("application/pdf")).toBe(false);
  });

  it("maps mime to ext", () => {
    expect(mimeToExt("image/jpeg")).toBe("jpg");
    expect(mimeToExt("image/png")).toBe("png");
    expect(mimeToExt("image/gif")).toBeNull();
  });
});

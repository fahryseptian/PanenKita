import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const swPath = path.resolve(__dirname, "../public/sw.js");
const offlinePath = path.resolve(__dirname, "../public/offline.html");

const sw = readFileSync(swPath, "utf8");
const offline = readFileSync(offlinePath, "utf8");

describe("service worker", () => {
  it("precache offline page and app icon", () => {
    expect(sw).toContain('"/offline.html"');
    expect(sw).toContain('"/icon.svg"');
    expect(offline).toContain("<!doctype html>");
  });

  it("caches app shell under versioned cache names", () => {
    expect(sw).toMatch(/panenkita-shell-\$\{VERSION\}/);
    expect(sw).toMatch(/panenkita-runtime-\$\{VERSION\}/);
    // Versi cache diset untuk invalidasi saat deploy.
    expect(sw).toMatch(/const VERSION = "\S+"/);
  });

  it("purges stale caches on activate", () => {
    expect(sw).toContain('caches.delete(name)');
    expect(sw).toContain("skipWaiting");
    expect(sw).toContain("clients.claim()");
  });

  it("never caches API requests", () => {
    expect(sw).toContain('"/api/"');
  });

  it("never caches cross-origin requests", () => {
    expect(sw).toContain("self.location.origin");
  });

  it("falls back to offline page for uncached navigation", () => {
    expect(sw).toContain('caches.match(OFFLINE_URL)');
    expect(sw).toContain('"/offline.html"');
  });

  it("serves static assets stale-while-revalidate", () => {
    expect(sw).toContain("/_next/static/");
    expect(sw).toContain("cache.put(request, response.clone())");
  });

  it("supports SKIP_WAITING message to activate new versions", () => {
    expect(sw).toContain('"SKIP_WAITING"');
  });
});

describe("offline page", () => {
  it("is self-contained (no external assets that require network)", () => {
    expect(offline).not.toMatch(/<link[^>]+href="https?:/);
    expect(offline).not.toMatch(/<script[^>]+src=/);
    expect(offline).not.toMatch(/src="\/_next/);
  });

  it("has a retry button that reloads the page", () => {
    expect(offline).toContain("location.reload()");
    expect(offline).toContain("Coba lagi");
  });

  it("uses the PanenKita green theme", () => {
    expect(offline).toContain("#16a34a");
  });
});

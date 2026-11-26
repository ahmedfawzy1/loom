import { CTA_URL_PATTERN, isCtaUrlOnSite, siteHost } from "@loom/dto/constants";
import { describe, expect, it } from "vitest";

/**
 * A CTA url is stored and rendered inside published pages, so anything accepted that is not a
 * destination on the CTA's own Site is a stored open redirect reaching real traffic.
 *
 * The original pattern's relative branch was `\/[^\s]*`, which matched `//evil.com` — a
 * protocol-relative URL every browser treats as off-site.
 */
describe("CTA_URL_PATTERN", () => {
  const accepts = (url: string) => CTA_URL_PATTERN.test(url);

  it("accepts a relative path", () => {
    expect(accepts("/pricing")).toBe(true);
    expect(accepts("/")).toBe(true);
    expect(accepts("/a/b?c=d#e")).toBe(true);
  });

  it("accepts an https URL, including subdomains", () => {
    expect(accepts("https://example.com")).toBe(true);
    expect(accepts("https://example.com/pricing")).toBe(true);
    expect(accepts("https://blog.example.com/post")).toBe(true);
  });

  it("rejects a protocol-relative URL disguised as a path", () => {
    expect(accepts("//evil.com")).toBe(false);
  });

  it("rejects a backslash path that browsers normalise to //", () => {
    expect(accepts("/\\evil.com")).toBe(false);
  });

  it("rejects credentials smuggled in front of the real host", () => {
    expect(accepts("https://example.com@evil.com")).toBe(false);
    expect(accepts("https://example.com:443@evil.com")).toBe(false);
  });

  it("rejects plaintext http", () => {
    expect(accepts("http://example.com")).toBe(false);
  });

  it("rejects a javascript: payload", () => {
    expect(accepts("javascript:alert(1)")).toBe(false);
  });
});

describe("isCtaUrlOnSite", () => {
  const onSite = (url: string, domain = "example.com") =>
    CTA_URL_PATTERN.test(url) && isCtaUrlOnSite(url, domain);

  it("accepts the Site's domain over https, including subdomains", () => {
    expect(onSite("https://example.com")).toBe(true);
    expect(onSite("https://example.com/pricing")).toBe(true);
    expect(onSite("https://blog.example.com/post")).toBe(true);
  });

  it("accepts a relative path on any Site", () => {
    expect(onSite("/pricing")).toBe(true);
  });

  it("rejects an outright external host", () => {
    expect(onSite("https://evil.com")).toBe(false);
  });

  it("rejects a lookalike domain that merely contains the real one", () => {
    expect(onSite("https://example.com.evil.com")).toBe(false);
    expect(onSite("https://notexample.com")).toBe(false);
  });

  it("rejects another Site's domain", () => {
    expect(onSite("https://example.com", "other.org")).toBe(false);
  });

  it("reads the Site domain however it was typed", () => {
    expect(onSite("https://example.com/x", "https://www.Example.com/")).toBe(
      true,
    );
    expect(siteHost(" HTTPS://www.example.com:8443/path ")).toBe("example.com");
  });

  it("rejects everything when the Site has no usable domain", () => {
    expect(isCtaUrlOnSite("https://example.com", "")).toBe(false);
  });

  it("rejects a protocol-relative path even without the pattern", () => {
    expect(isCtaUrlOnSite("//evil.com", "example.com")).toBe(false);
    expect(isCtaUrlOnSite("/\\evil.com", "example.com")).toBe(false);
  });
});

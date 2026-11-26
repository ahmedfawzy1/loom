import type { Request } from "express";
import { describe, expect, it } from "vitest";
import {
  clientIp,
  isAdminRequest,
  isCrossSiteWrite,
  readCookie,
} from "./auth-request.util";

const request = (overrides: Partial<Request> = {}) =>
  ({
    method: "POST",
    path: "/admin/auth/login",
    headers: {},
    ip: "203.0.113.7",
    ...overrides,
  }) as Request;

describe("readCookie", () => {
  it("finds one cookie among several", () => {
    expect(
      readCookie("a=1; loom_session=abc-DEF_123; b=2", "loom_session"),
    ).toBe("abc-DEF_123");
  });

  it("does not mistake a cookie whose name only starts the same", () => {
    expect(
      readCookie("loom_session_old=stale", "loom_session"),
    ).toBeUndefined();
  });

  it.each([
    ["no header", undefined],
    ["no such cookie", "a=1; b=2"],
    ["an empty value", "loom_session="],
    ["a value that is not valid encoding", "loom_session=%E0%A4%A"],
  ])("gives nothing for %s", (_, header) => {
    expect(readCookie(header, "loom_session")).toBeUndefined();
  });
});

describe("isCrossSiteWrite", () => {
  it.each([
    "cross-site",
    "same-site",
  ])("refuses a write a browser marks %s", (site) => {
    expect(
      isCrossSiteWrite(request({ headers: { "sec-fetch-site": site } })),
    ).toBe(true);
  });

  it.each([
    ["the admin app's own request", { "sec-fetch-site": "same-origin" }],
    ["a client that sends no Fetch Metadata", {}],
  ])("lets through %s", (_, headers) => {
    expect(isCrossSiteWrite(request({ headers }))).toBe(false);
  });

  it("leaves reads alone: they change nothing", () => {
    expect(
      isCrossSiteWrite(
        request({ method: "GET", headers: { "sec-fetch-site": "cross-site" } }),
      ),
    ).toBe(false);
  });
});

describe("isAdminRequest", () => {
  it.each([
    ["/admin/users", true],
    ["/admin", true],
    ["/administrator", false],
    ["/content/demo/production/blogs", false],
    ["/mcp", false],
  ])("%s → %s", (path, expected) => {
    expect(isAdminRequest(request({ path }))).toBe(expected);
  });
});

describe("clientIp", () => {
  it("is the forwarded address when a proxy reported one", () => {
    expect(
      clientIp(request({ headers: { "x-forwarded-for": "203.0.113.7" } })),
    ).toBe("203.0.113.7");
  });

  it("is unknown when nothing reported one, rather than the admin app's own address", () => {
    expect(clientIp(request())).toBeUndefined();
  });
});

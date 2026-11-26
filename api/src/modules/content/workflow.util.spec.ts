import { LocaleStatus } from "@loom/database";
import { ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  afterSave,
  approve,
  isLive,
  type LocaleState,
  publish,
  requestChanges,
  submit,
  unpublish,
} from "./workflow.util";

const NOW = new Date("2026-09-18T12:00:00Z");
const EARLIER = new Date("2026-01-01T00:00:00Z");

const locale = (overrides: Partial<LocaleState>): LocaleState => ({
  status: LocaleStatus.DRAFT,
  revision: 3,
  publishedRevision: null,
  firstPublishedAt: null,
  submittedById: null,
  ...overrides,
});

const draft = locale({});
const published = locale({
  status: LocaleStatus.PUBLISHED,
  publishedRevision: 3,
  firstPublishedAt: EARLIER,
});
const changed = locale({
  status: LocaleStatus.CHANGED,
  revision: 5,
  publishedRevision: 3,
  firstPublishedAt: EARLIER,
});
const reviewNew = locale({
  status: LocaleStatus.IN_REVIEW,
  submittedById: "writer",
});
const reviewLive = locale({
  status: LocaleStatus.IN_REVIEW,
  revision: 5,
  publishedRevision: 3,
  firstPublishedAt: EARLIER,
  submittedById: "writer",
});

describe("afterSave — C5, plan §41 rule 15", () => {
  it("moves published content to Changed and keeps it live", () => {
    expect(afterSave(published)).toEqual({ status: LocaleStatus.CHANGED });
  });

  it("leaves drafts, changed and unpublished content where they are", () => {
    expect(afterSave(draft)).toEqual({});
    expect(afterSave(changed)).toEqual({});
    expect(afterSave(locale({ status: LocaleStatus.UNPUBLISHED }))).toEqual({});
  });

  // What was submitted is no longer what is there, so approving it would publish something unseen
  it("withdraws a submission, to Draft or Changed by whether anything is live", () => {
    expect(afterSave(reviewNew)).toMatchObject({
      status: LocaleStatus.DRAFT,
      submittedById: null,
    });
    expect(afterSave(reviewLive)).toMatchObject({
      status: LocaleStatus.CHANGED,
      submittedById: null,
    });
  });
});

describe("submit", () => {
  it("puts a draft or changed locale in review and clears an old note", () => {
    expect(submit(changed, "writer", NOW)).toMatchObject({
      status: LocaleStatus.IN_REVIEW,
      submittedById: "writer",
      submittedAt: NOW,
      reviewNote: null,
    });
    expect(submit(draft, "writer", NOW).status).toBe(LocaleStatus.IN_REVIEW);
  });

  it("refuses when there is nothing new to review", () => {
    expect(() => submit(published, "writer", NOW)).toThrow(ConflictException);
    expect(() => submit(reviewNew, "writer", NOW)).toThrow(ConflictException);
  });
});

describe("publish", () => {
  it("makes the current revision live and records the first publish once", () => {
    expect(publish(draft, "author", NOW)).toMatchObject({
      status: LocaleStatus.PUBLISHED,
      publishedRevision: 3,
      publishedAt: NOW,
      firstPublishedAt: NOW,
    });
    expect(publish(changed, "author", NOW)).toMatchObject({
      publishedRevision: 5,
      firstPublishedAt: EARLIER,
    });
  });

  it("refuses when the latest is already live", () => {
    expect(() => publish(published, "author", NOW)).toThrow(ConflictException);
  });

  // A direct publish did not come from the submission, so the submission record would misdescribe it
  it("clears the submitter on a direct publish but keeps it on an approval", () => {
    expect(publish(changed, "author", NOW).submittedById).toBeNull();
    expect(approve(reviewLive, "author", NOW)).toMatchObject({
      status: LocaleStatus.PUBLISHED,
      publishedRevision: 5,
      reviewedById: "author",
    });
    expect(approve(reviewLive, "author", NOW)).not.toHaveProperty(
      "submittedById",
    );
  });

  it("only approves what is in review", () => {
    expect(() => approve(draft, "author", NOW)).toThrow(ConflictException);
  });
});

describe("requestChanges — plan §18", () => {
  it("returns an unpublished submission to Draft with the note", () => {
    expect(requestChanges(reviewNew, "author", "Fix the intro", NOW)).toEqual({
      status: LocaleStatus.DRAFT,
      reviewNote: "Fix the intro",
      reviewedById: "author",
      reviewedAt: NOW,
    });
  });

  // DRAFT would claim the locale is not live, when its published version is still serving
  it("returns a live one to Changed, not Draft", () => {
    expect(
      requestChanges(reviewLive, "author", "Fix the intro", NOW).status,
    ).toBe(LocaleStatus.CHANGED);
  });

  it("only acts on what is in review", () => {
    expect(() => requestChanges(changed, "author", "x", NOW)).toThrow(
      ConflictException,
    );
  });
});

describe("unpublish", () => {
  it("takes live content off the website", () => {
    expect(unpublish(changed)).toEqual({
      status: LocaleStatus.UNPUBLISHED,
      publishedRevision: null,
    });
  });

  it("keeps a pending submission in review", () => {
    expect(unpublish(reviewLive).status).toBe(LocaleStatus.IN_REVIEW);
  });

  it("refuses when nothing is live", () => {
    expect(() => unpublish(draft)).toThrow(ConflictException);
    expect(isLive(reviewNew)).toBe(false);
  });
});

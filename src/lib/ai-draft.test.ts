import { describe, expect, it } from "vitest";

import { draftBodyToHtml, parseAiDraftMessage } from "@/lib/ai-draft";

describe("parseAiDraftMessage", () => {
  it("splits Subject and Body from the model format", () => {
    const parsed = parseAiDraftMessage(
      "Subject: Thanks for coming in\nBody:\nHi Alex,\n\nGreat to see you.",
    );
    expect(parsed.subject).toBe("Thanks for coming in");
    expect(parsed.body).toContain("Hi Alex");
    expect(parsed.body).toContain("Great to see you.");
  });

  it("falls back to the first line when Subject is missing", () => {
    const parsed = parseAiDraftMessage(
      "Hope the colour settled well.\nSee you soon.",
    );
    expect(parsed.subject).toBe("Hope the colour settled well.");
    expect(parsed.body).toContain("See you soon.");
  });
});

describe("draftBodyToHtml", () => {
  it("escapes HTML and keeps paragraphs", () => {
    expect(draftBodyToHtml("Hi <Alex>\n\nThanks")).toBe(
      "<p>Hi &lt;Alex&gt;</p>\n<p>Thanks</p>",
    );
  });
});

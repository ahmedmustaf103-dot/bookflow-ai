import { describe, expect, it } from "vitest";

import { matchDemoAssistantIntent } from "./demo-intent";

describe("matchDemoAssistantIntent", () => {
  it("recognizes today’s booking count", () => {
    expect(matchDemoAssistantIntent("How many appointments do I have today?")).toEqual({
      kind: "today_count",
    });
  });

  it("recognizes popular service questions", () => {
    expect(matchDemoAssistantIntent("Which service is most popular?")).toEqual({
      kind: "popular_service",
    });
  });

  it("finds a named staff member this week", () => {
    expect(
      matchDemoAssistantIntent("Find me an appointment with James this week."),
    ).toEqual({ kind: "staff_week", staffHint: "james" });
  });

  it("recognizes staff leader, due return, and quiet periods", () => {
    expect(matchDemoAssistantIntent("Who has the most bookings?")).toEqual({
      kind: "staff_leader",
    });
    expect(matchDemoAssistantIntent("Which customers are due a return visit?")).toEqual({
      kind: "due_return",
    });
    expect(matchDemoAssistantIntent("When is the quietest period?")).toEqual({
      kind: "quiet",
    });
  });

  it("falls back to a generic sample answer", () => {
    expect(matchDemoAssistantIntent("Tell me a joke")).toEqual({
      kind: "generic",
    });
  });
});

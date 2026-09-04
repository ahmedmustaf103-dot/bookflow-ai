export type DemoAssistantIntent =
  | { kind: "today_count" }
  | { kind: "popular_service" }
  | { kind: "staff_week"; staffHint: string }
  | { kind: "due_return" }
  | { kind: "staff_leader" }
  | { kind: "quiet" }
  | { kind: "generic" };

export function matchDemoAssistantIntent(message: string): DemoAssistantIntent {
  const q = message.toLowerCase();
  if (
    /(how many|appointments today|bookings today|today'?s (bookings|appointments))/.test(
      q,
    )
  ) {
    return { kind: "today_count" };
  }
  if (/(most popular|most booked|popular service)/.test(q)) {
    return { kind: "popular_service" };
  }
  if (/(due|return visit|rebook|haven'?t (been|visited))/.test(q)) {
    return { kind: "due_return" };
  }
  if (/(highest number|busiest staff|most bookings)/.test(q)) {
    return { kind: "staff_leader" };
  }
  const staff = q.match(/\b(james|adam|omar|daniel)\b/);
  if (staff && /(find|available|availability|this week|appointment)/.test(q)) {
    return { kind: "staff_week", staffHint: staff[1]! };
  }
  if (/(quiet|availability|least busy)/.test(q)) {
    return { kind: "quiet" };
  }
  return { kind: "generic" };
}

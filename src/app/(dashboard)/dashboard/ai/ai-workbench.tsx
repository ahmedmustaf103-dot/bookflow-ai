"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  bookingAssistantAction,
  clientSummaryAction,
  messageDraftAction,
} from "@/server/actions/ai";

type ClientOption = { id: string; name: string };

export function AiWorkbench({
  clients,
  providerReady,
  planLabel,
  tokensUsed,
  tokensLimit,
}: {
  clients: ClientOption[];
  providerReady: boolean;
  planLabel: string;
  tokensUsed: number;
  tokensLimit: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);

  if (!providerReady) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] p-5 text-sm text-[var(--color-ink)]/70">
        Add <code>OPENAI_API_KEY</code> or{" "}
        <code>GOOGLE_GENERATIVE_AI_API_KEY</code> to <code>.env.local</code> to
        enable AI features.
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-8">
        <section className="rounded-lg border border-[var(--color-border)] p-5">
          <h2 className="text-lg font-semibold">Client summary</h2>
          <p className="mt-1 text-sm text-[var(--color-ink)]/60">
            Prep brief from history + notes. Staff-only.
          </p>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setError(null);
              startTransition(async () => {
                const result = await clientSummaryAction(fd);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setOutput(result.data.text);
                setMeta(`${result.data.tokens} tokens`);
              });
            }}
          >
            <select
              name="clientId"
              required
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              defaultValue={clients[0]?.id}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={pending || clients.length === 0}>
              {pending ? "Generating…" : "Generate summary"}
            </Button>
          </form>
        </section>

        <section className="rounded-lg border border-[var(--color-border)] p-5">
          <h2 className="text-lg font-semibold">Message draft</h2>
          <p className="mt-1 text-sm text-[var(--color-ink)]/60">
            Editable copy only — nothing sends automatically.
          </p>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setError(null);
              startTransition(async () => {
                const result = await messageDraftAction(fd);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setOutput(result.data.text);
                setMeta(`${result.data.tokens} tokens`);
              });
            }}
          >
            <select
              name="intent"
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              defaultValue="reminder"
            >
              <option value="reminder">Reminder</option>
              <option value="win_back">Win-back</option>
              <option value="thank_you">Thank you</option>
              <option value="reschedule">Reschedule</option>
            </select>
            <select
              name="clientId"
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">No specific client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <textarea
              name="context"
              rows={2}
              placeholder="Optional context"
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Drafting…" : "Draft message"}
            </Button>
          </form>
        </section>

        <section className="rounded-lg border border-[var(--color-border)] p-5">
          <h2 className="text-lg font-semibold">Booking assistant</h2>
          <p className="mt-1 text-sm text-[var(--color-ink)]/60">
            Uses tools for slots. Proposals require human confirmation.
          </p>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setError(null);
              startTransition(async () => {
                const result = await bookingAssistantAction(fd);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setOutput(result.data.text);
                setMeta(`${result.data.tokens} tokens`);
              });
            }}
          >
            <textarea
              name="message"
              required
              rows={3}
              placeholder='e.g. "Find a haircut slot for Alex next Thursday afternoon"'
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Thinking…" : "Ask assistant"}
            </Button>
          </form>
        </section>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-[var(--color-border)] p-5 text-sm">
          <p>
            Plan: <span className="font-medium">{planLabel}</span>
          </p>
          <p className="mt-1 text-[var(--color-ink)]/65">
            Tokens this month: {tokensUsed.toLocaleString()}
            {tokensLimit != null
              ? ` / ${tokensLimit.toLocaleString()}`
              : " / ∞"}
          </p>
        </div>

        <div className="min-h-[20rem] flex-1 rounded-lg border border-[var(--color-border)] bg-white/60 p-5">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
            Output
          </h2>
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {meta ? (
            <p className="mt-2 text-xs text-[var(--color-ink)]/50">{meta}</p>
          ) : null}
          <pre className="mt-3 font-sans text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-ink)]/85">
            {output ?? "Results appear here. Edit before sending to clients."}
          </pre>
        </div>
      </div>
    </div>
  );
}

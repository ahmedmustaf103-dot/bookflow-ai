"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, Textarea } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
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
      <Surface>
        <p className="text-sm text-[var(--ink-tertiary)]">
          Add <code>OPENAI_API_KEY</code> or{" "}
          <code>GOOGLE_GENERATIVE_AI_API_KEY</code> to <code>.env.local</code>{" "}
          to enable AI features.
        </p>
      </Surface>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Surface>
          <h2 className="text-sm font-semibold">Client summary</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
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
            <div>
              <Label htmlFor="summary-client">Client</Label>
              <Select
                id="summary-client"
                name="clientId"
                required
                defaultValue={clients[0]?.id}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={pending || clients.length === 0}>
              {pending ? "Generating…" : "Generate summary"}
            </Button>
          </form>
        </Surface>

        <Surface>
          <h2 className="text-sm font-semibold">Message draft</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
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
            <div>
              <Label htmlFor="draft-intent">Intent</Label>
              <Select
                id="draft-intent"
                name="intent"
                defaultValue="reminder"
              >
                <option value="reminder">Reminder</option>
                <option value="win_back">Win-back</option>
                <option value="thank_you">Thank you</option>
                <option value="reschedule">Reschedule</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="draft-client">Client (optional)</Label>
              <Select id="draft-client" name="clientId" defaultValue="">
                <option value="">No specific client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="draft-context">Context</Label>
              <Textarea
                id="draft-context"
                name="context"
                rows={2}
                placeholder="Optional context"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Drafting…" : "Draft message"}
            </Button>
          </form>
        </Surface>

        <Surface>
          <h2 className="text-sm font-semibold">Booking assistant</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
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
            <div>
              <Label htmlFor="assistant-message">Message</Label>
              <Textarea
                id="assistant-message"
                name="message"
                required
                rows={3}
                placeholder='e.g. "Find a haircut slot for Alex next Thursday afternoon"'
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Thinking…" : "Ask assistant"}
            </Button>
          </form>
        </Surface>
      </div>

      <div className="flex flex-col gap-4">
        <Surface>
          <p className="text-sm">
            Plan: <span className="font-medium">{planLabel}</span>
          </p>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
            Tokens this month: {tokensUsed.toLocaleString()}
            {tokensLimit != null
              ? ` / ${tokensLimit.toLocaleString()}`
              : " / ∞"}
          </p>
        </Surface>

        <Surface className="min-h-[20rem] flex-1">
          <h2 className="text-xs font-semibold tracking-wide text-[var(--accent)] uppercase">
            Output
          </h2>
          {error ? (
            <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          {meta ? (
            <p className="mt-2 text-xs text-[var(--ink-tertiary)]">{meta}</p>
          ) : null}
          <pre className="mt-3 font-sans text-sm leading-relaxed whitespace-pre-wrap text-[var(--ink-secondary)]">
            {output ?? "Results appear here. Edit before sending to clients."}
          </pre>
        </Surface>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, Textarea } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { AiBookingProposal } from "@/server/ai/constants";
import {
  bookingAssistantAction,
  clientSummaryAction,
  confirmAiBookingProposalAction,
  insightDigestAction,
  messageDraftAction,
  sendAiDraftAction,
} from "@/server/actions/ai";

type ClientOption = { id: string; name: string; email: string | null };

type AiRunPreview = {
  id: string;
  feature: string;
  createdAt: string;
  outputPreview: string | null;
  tokens: number;
};

type ActiveFeature =
  | "summary"
  | "draft"
  | "insights"
  | "assistant"
  | null;

function featureLabel(feature: string) {
  if (feature === "client_summary") return "Client summary";
  if (feature === "message_draft") return "Message draft";
  if (feature === "insight_digest") return "Business insights";
  if (feature === "booking_assistant") return "Booking assistant";
  return feature;
}

export function AiWorkbench({
  clients,
  providerReady,
  planAllowsAi,
  planLabel,
  tokensUsed,
  tokensLimit,
  recentRuns,
  initialClientId,
  initialIntent,
}: {
  clients: ClientOption[];
  providerReady: boolean;
  planAllowsAi: boolean;
  planLabel: string;
  tokensUsed: number;
  tokensLimit: number | null;
  recentRuns: AiRunPreview[];
  initialClientId?: string;
  initialIntent?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<ActiveFeature>(null);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string>("");
  const [meta, setMeta] = useState<string | null>(null);
  const [outputKind, setOutputKind] = useState<string>("Output");
  const [proposal, setProposal] = useState<AiBookingProposal | null>(null);
  const [confirmPending, startConfirm] = useTransition();
  const [sendPending, startSend] = useTransition();

  const defaultClientId = useMemo(() => {
    if (initialClientId && clients.some((c) => c.id === initialClientId)) {
      return initialClientId;
    }
    return clients[0]?.id ?? "";
  }, [clients, initialClientId]);

  const [draftClientId, setDraftClientId] = useState(defaultClientId);

  const defaultIntent = [
    "reminder",
    "win_back",
    "thank_you",
    "reschedule",
    "review_request",
    "follow_up",
  ].includes(initialIntent ?? "")
    ? initialIntent!
    : "reminder";

  if (!providerReady) {
    return (
      <Surface className="p-5">
        <h2 className="text-sm font-semibold">AI not configured</h2>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">
          AI isn’t available on this BookFlow account yet. Contact BookFlow if
          you need it.
        </p>
      </Surface>
    );
  }

  if (!planAllowsAi) {
    return (
      <Surface className="p-5">
        <h2 className="text-sm font-semibold">AI not on this plan</h2>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">
          {planLabel} does not include AI. Upgrade to Growth or Business to use
          summaries, drafts, and the booking assistant.
        </p>
      </Surface>
    );
  }

  function runFeature(
    feature: Exclude<ActiveFeature, null>,
    label: string,
    action: () => Promise<
      | { ok: true; data: { text: string; tokens: number; proposal?: AiBookingProposal | null } }
      | { ok: false; error: string }
    >,
  ) {
    setError(null);
    setProposal(null);
    setActive(feature);
    setOutputKind(label);
    startTransition(async () => {
      const result = await action();
      setActive(null);
      if (!result.ok) {
        setError(result.error);
        toast(result.error, "error");
        return;
      }
      setOutput(result.data.text);
      setMeta(`${result.data.tokens.toLocaleString()} tokens`);
      if ("proposal" in result.data) {
        setProposal(result.data.proposal ?? null);
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-4">
        <Surface className="p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm">
                Plan: <span className="font-medium">{planLabel}</span>
              </p>
              <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                Tokens this month: {tokensUsed.toLocaleString("en-GB")}
                {tokensLimit != null
                  ? ` / ${tokensLimit.toLocaleString("en-GB")}`
                  : " / ∞"}
              </p>
            </div>
            <p className="text-xs text-[var(--ink-tertiary)]">
              AI drafts and proposes — you always confirm.
            </p>
          </div>
        </Surface>

        <Surface className="p-4">
          <h2 className="text-sm font-semibold">Client summary</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
            Prep brief before a visit: patterns, risks, talking points.
          </p>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              runFeature("summary", "Client summary", () =>
                clientSummaryAction(fd),
              );
            }}
          >
            <div>
              <Label htmlFor="summary-client">Client</Label>
              <Select
                id="summary-client"
                name="clientId"
                required
                defaultValue={defaultClientId}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="submit"
              disabled={pending || clients.length === 0}
            >
              {active === "summary" ? "Generating…" : "Generate summary"}
            </Button>
          </form>
        </Surface>

        <Surface className="p-4">
          <h2 className="text-sm font-semibold">Message draft</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
            Follow-ups, reminders, review asks. Edit the draft, then send if you
            like it.
          </p>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setDraftClientId(String(fd.get("clientId") ?? ""));
              runFeature("draft", "Message draft", () =>
                messageDraftAction(fd),
              );
            }}
          >
            <div>
              <Label htmlFor="draft-intent">Intent</Label>
              <Select
                id="draft-intent"
                name="intent"
                defaultValue={defaultIntent}
              >
                <option value="reminder">Appointment reminder</option>
                <option value="follow_up">Post-visit follow-up</option>
                <option value="thank_you">Thank you</option>
                <option value="review_request">Review request</option>
                <option value="win_back">Win-back</option>
                <option value="reschedule">Reschedule</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="draft-client">Client</Label>
              <Select
                id="draft-client"
                name="clientId"
                defaultValue={defaultClientId}
                onChange={(e) => setDraftClientId(e.target.value)}
              >
                <option value="">Choose a client to send to</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email ? `${c.name} · ${c.email}` : `${c.name} (no email)`}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="draft-context">Extra context</Label>
              <Textarea
                id="draft-context"
                name="context"
                rows={2}
                placeholder="e.g. last visit was a colour — ask how it settled"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {active === "draft" ? "Drafting…" : "Draft message"}
            </Button>
          </form>
        </Surface>

        <Surface className="p-4">
          <h2 className="text-sm font-semibold">Business insights</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
            30-day snapshot with concrete actions (no-shows, rebooking, focus).
          </p>
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              runFeature("insights", "Business insights", () =>
                insightDigestAction(fd),
              );
            }}
          >
            <Button type="submit" disabled={pending}>
              {active === "insights" ? "Analyzing…" : "Generate insights"}
            </Button>
          </form>
        </Surface>

        <Surface className="p-4">
          <h2 className="text-sm font-semibold">Booking recommendations</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
            Finds real slots and proposes a booking for you to confirm.
          </p>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              runFeature("assistant", "Booking assistant", () =>
                bookingAssistantAction(fd),
              );
            }}
          >
            <div>
              <Label htmlFor="assistant-message">What do you need?</Label>
              <Textarea
                id="assistant-message"
                name="message"
                required
                rows={3}
                placeholder='e.g. "Find a 30-min cut for Alex next Thursday afternoon with Sam"'
              />
            </div>
            <Button type="submit" disabled={pending}>
              {active === "assistant" ? "Thinking…" : "Get recommendations"}
            </Button>
          </form>
        </Surface>
      </div>

      <div className="flex flex-col gap-4">
        <Surface className="min-h-[22rem] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-[var(--accent)] uppercase">
              {outputKind}
            </h2>
            <div className="flex gap-2">
              {output ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(output);
                      toast("Copied", "success");
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setOutput("");
                      setMeta(null);
                      setError(null);
                      setProposal(null);
                    }}
                  >
                    Clear
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          {meta ? (
            <p className="mt-2 text-xs text-[var(--ink-tertiary)]">{meta}</p>
          ) : null}

          {pending && !output ? (
            <div className="mt-4 space-y-2" aria-busy>
              <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--border)]" />
              <div className="h-3 w-full animate-pulse rounded bg-[var(--border)]" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-[var(--border)]" />
            </div>
          ) : (
            <Textarea
              className="mt-3 min-h-[16rem] font-sans text-sm leading-relaxed"
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              placeholder="Results appear here. Edit drafts before sending to clients."
            />
          )}

          {outputKind === "Message draft" && output.trim() ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={sendPending || pending}
                onClick={() => {
                  if (!draftClientId) {
                    toast("Pick a client before sending", "error");
                    return;
                  }
                  const selected = clients.find((c) => c.id === draftClientId);
                  if (!selected?.email) {
                    toast("That client has no email on file", "error");
                    return;
                  }
                  const fd = new FormData();
                  fd.set("clientId", draftClientId);
                  fd.set("message", output);
                  startSend(async () => {
                    const result = await sendAiDraftAction(fd);
                    if (!result.ok) {
                      toast(result.error, "error");
                      return;
                    }
                    toast(`Sent to ${selected.email}`, "success");
                  });
                }}
              >
                {sendPending ? "Sending…" : "Send to client"}
              </Button>
              <p className="text-xs text-[var(--ink-tertiary)]">
                Sends the edited text above. Nothing goes out until you press
                this.
              </p>
            </div>
          ) : null}

          {proposal ? (
            <div className="mt-4 rounded-[var(--radius-panel)] border border-[var(--accent)]/40 bg-[var(--accent-soft)]/40 p-3">
              <p className="text-xs font-semibold tracking-wide text-[var(--accent)] uppercase">
                Proposed booking — confirm to create
              </p>
              <p className="mt-2 text-sm font-medium">
                {proposal.clientName} · {proposal.serviceName}
              </p>
              <p className="text-sm text-[var(--ink-secondary)]">
                {proposal.label} with {proposal.resourceName}
              </p>
              {proposal.rationale ? (
                <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                  {proposal.rationale}
                </p>
              ) : null}
              <form
                className="mt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData();
                  fd.set("serviceId", proposal.serviceId);
                  fd.set("resourceId", proposal.resourceId);
                  fd.set("startAt", proposal.startIso);
                  fd.set("clientName", proposal.clientName);
                  if (proposal.clientEmail) {
                    fd.set("clientEmail", proposal.clientEmail);
                  }
                  if (proposal.clientPhone) {
                    fd.set("clientPhone", proposal.clientPhone);
                  }
                  if (proposal.notes) fd.set("notes", proposal.notes);
                  startConfirm(async () => {
                    const result = await confirmAiBookingProposalAction(fd);
                    if (!result.ok) {
                      setError(result.error);
                      toast(result.error, "error");
                      return;
                    }
                    toast("Booking confirmed", "success");
                    setProposal(null);
                    router.refresh();
                  });
                }}
              >
                <Button
                  type="submit"
                  size="sm"
                  disabled={confirmPending}
                >
                  {confirmPending ? "Booking…" : "Confirm booking"}
                </Button>
              </form>
            </div>
          ) : null}
        </Surface>

        <Surface className="p-4">
          <h2 className="text-sm font-semibold">Recent AI runs</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
            Conversation history for this workspace (latest first).
          </p>
          {recentRuns.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ink-secondary)]">
              No runs yet. Generate a summary or draft to start the history.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {recentRuns.map((run) => (
                <li key={run.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">
                      {featureLabel(run.feature)}
                    </p>
                    <p className="text-[11px] tabular-nums text-[var(--ink-tertiary)]">
                      {format(new Date(run.createdAt), "dd/MM/yyyy, HH:mm:ss")} ·{" "}
                      {run.tokens.toLocaleString("en-GB")} tok
                    </p>
                  </div>
                  <p className="mt-1 line-clamp-3 text-xs text-[var(--ink-secondary)]">
                    {run.outputPreview || "—"}
                  </p>
                  {run.outputPreview ? (
                    <button
                      type="button"
                      className="mt-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
                      onClick={() => {
                        setOutput(run.outputPreview ?? "");
                        setOutputKind(featureLabel(run.feature));
                        setMeta("Restored from history");
                        setProposal(null);
                        setError(null);
                      }}
                    >
                      Open in editor
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </div>
  );
}

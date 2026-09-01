"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { fireConfetti } from "@/lib/confetti";
import { createOrganizationAction } from "@/server/actions/tenant";
import { listVerticalPacks } from "@/server/verticals/packs";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Australia/Sydney",
];

const PACKS = listVerticalPacks();

export function OnboardingForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <Surface className="bf-page-enter w-full max-w-md">
      <div className="mb-5 flex items-center gap-2 text-xs text-[var(--ink-tertiary)]">
        <span
          className={
            step === 1 ? "font-semibold text-[var(--accent)]" : "text-[var(--accent)]"
          }
        >
          1. Business
        </span>
        <span aria-hidden>→</span>
        <span className={step === 2 ? "font-semibold text-[var(--accent)]" : ""}>
          2. Confirm
        </span>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 1) {
            const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
            if (name.length < 2) {
              setError("Business name must be at least 2 characters");
              return;
            }
            setError(null);
            setStep(2);
            return;
          }
          const formData = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            try {
              const result = await createOrganizationAction(formData);
              if (!result.ok) {
                setError(result.error);
                toast(result.error, "error");
                return;
              }
              toast("You're live — welcome to BookFlow", "success");
              fireConfetti();
              router.push("/dashboard");
              router.refresh();
            } catch {
              const msg =
                "Could not reach the server. Refresh and make sure the app is running.";
              setError(msg);
              toast(msg, "error");
            }
          });
        }}
      >
        <div className={step === 1 ? "flex flex-col gap-4" : "hidden"}>
          <div>
            <Label htmlFor="biz-name">Business name</Label>
            <Input
              id="biz-name"
              name="name"
              required
              minLength={2}
              placeholder="Northside Barbers"
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-medium text-[var(--ink-secondary)]">
              Business type
            </legend>
            <div className="flex flex-col gap-2">
              {PACKS.map((pack, index) => (
                <label
                  key={pack.id}
                  className="bf-row-hover flex cursor-pointer gap-3 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2.5 text-sm has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]"
                >
                  <input
                    type="radio"
                    name="verticalPack"
                    value={pack.id}
                    defaultChecked={index === 0}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="font-medium">{pack.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--ink-tertiary)]">
                      {pack.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="biz-tz">Timezone</Label>
            <Select
              id="biz-tz"
              name="timezone"
              defaultValue="America/New_York"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {step === 2 ? (
          <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--muted)]/50 px-3 py-3 text-sm text-[var(--ink-secondary)]">
            We&apos;ll create your business, a main location, default hours,
            and starter services. You can edit everything after you&apos;re in.
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          {step === 2 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(1)}
              disabled={pending}
            >
              Back
            </Button>
          ) : null}
          <Button type="submit" disabled={pending} className="flex-1">
            {pending
              ? "Creating…"
              : step === 1
                ? "Continue"
                : "Create business"}
          </Button>
        </div>
      </form>
    </Surface>
  );
}

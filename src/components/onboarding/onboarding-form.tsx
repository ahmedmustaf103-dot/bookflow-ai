"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex w-full max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            const result = await createOrganizationAction(formData);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/dashboard");
            router.refresh();
          } catch {
            setError(
              "Could not reach the server. Refresh and make sure the app is running on the correct localhost port.",
            );
          }
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Business name</span>
        <input
          name="name"
          required
          minLength={2}
          placeholder="Northside Barbers"
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Business type</legend>
        <div className="flex flex-col gap-2">
          {PACKS.map((pack, index) => (
            <label
              key={pack.id}
              className="flex cursor-pointer gap-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm has-[:checked]:border-[var(--color-accent)]"
            >
              <input
                type="radio"
                name="verticalPack"
                value={pack.id}
                defaultChecked={index === 0}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{pack.label}</span>
                <span className="mt-0.5 block text-[var(--color-ink)]/60">
                  {pack.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Timezone</span>
        <select
          name="timezone"
          defaultValue="America/New_York"
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 outline-none focus:border-[var(--color-accent)]"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create business"}
      </Button>
    </form>
  );
}

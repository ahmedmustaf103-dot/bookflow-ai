"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createOrganizationAction } from "@/server/actions/tenant";

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
          const result = await createOrganizationAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push("/dashboard");
          router.refresh();
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

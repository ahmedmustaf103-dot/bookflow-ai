"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/input";
import { switchOrganizationAction } from "@/server/actions/tenant";

const DEMO_SWITCH_FLAG = "bf_switched_to_demo_shop";

export type DashboardOrgOption = {
  id: string;
  name: string;
  slug: string;
};

export function EnsureDemoShop({
  demoOrgId,
  currentOrgId,
}: {
  demoOrgId: string | null;
  currentOrgId: string | null;
}) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (!demoOrgId || !currentOrgId || demoOrgId === currentOrgId) return;
    if (window.localStorage.getItem(DEMO_SWITCH_FLAG) === demoOrgId) return;
    ran.current = true;
    window.localStorage.setItem(DEMO_SWITCH_FLAG, demoOrgId);
    void switchOrganizationAction(demoOrgId).then(() => {
      router.refresh();
    });
  }, [demoOrgId, currentOrgId, router]);

  return null;
}

export function OrgSwitcher({
  orgs,
  currentOrgId,
}: {
  orgs: DashboardOrgOption[];
  currentOrgId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (orgs.length === 0) return null;

  if (orgs.length === 1) {
    return (
      <p className="truncate border-b border-[var(--border)] px-4 py-2.5 text-xs text-[var(--ink-tertiary)]">
        {orgs[0]!.name}
      </p>
    );
  }

  return (
    <div className="border-b border-[var(--border)] px-3 py-2">
      <label className="sr-only" htmlFor="org-switcher">
        Shop
      </label>
      <Select
        id="org-switcher"
        className="h-8 px-2 text-xs"
        value={currentOrgId ?? orgs[0]!.id}
        disabled={pending}
        onChange={(event) => {
          const nextId = event.target.value;
          startTransition(() => {
            void switchOrganizationAction(nextId).then(() => {
              router.refresh();
            });
          });
        }}
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

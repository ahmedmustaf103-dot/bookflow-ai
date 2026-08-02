import { AiWorkbench } from "./ai-workbench";
import { getConfiguredProvider } from "@/server/ai/provider";
import { getPlanLimits, planAllowsAi } from "@/server/billing/plans";
import { requireOrgRole } from "@/server/tenant/context";

export default async function AiPage() {
  const ctx = await requireOrgRole("STAFF");
  const limits = getPlanLimits(ctx.organization.plan);

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const [clients, usage] = await Promise.all([
    ctx.db.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    ctx.db.aiRun.aggregate({
      where: {
        createdAt: { gte: start },
      },
      _sum: { tokensIn: true, tokensOut: true },
    }),
  ]);

  const tokensUsed = (usage._sum.tokensIn ?? 0) + (usage._sum.tokensOut ?? 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">AI</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Assistive tools only — AI never books without staff confirmation.
          {!planAllowsAi(ctx.organization.plan)
            ? " Your current plan has no AI budget."
            : null}
        </p>
      </div>

      <AiWorkbench
        clients={clients}
        providerReady={Boolean(getConfiguredProvider())}
        planLabel={ctx.organization.plan}
        tokensUsed={tokensUsed}
        tokensLimit={limits.aiTokensPerMonth}
      />
    </div>
  );
}

import { PageHeader } from "@/components/ui/page-header";
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI"
        description={`Assistive tools only — AI never books without staff confirmation.${
          !planAllowsAi(ctx.organization.plan)
            ? " Your current plan has no AI budget."
            : ""
        }`}
      />

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

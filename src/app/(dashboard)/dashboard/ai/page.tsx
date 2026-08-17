import { PageHeader } from "@/components/ui/page-header";
import { AiWorkbench } from "./ai-workbench";
import { getConfiguredProvider } from "@/server/ai/provider";
import { getPlanLimits, planAllowsAi } from "@/server/billing/plans";
import { requireOrgRole } from "@/server/tenant/context";

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; intent?: string }>;
}) {
  const ctx = await requireOrgRole("STAFF");
  const params = await searchParams;
  const limits = getPlanLimits(ctx.organization.plan);
  const allowsAi = planAllowsAi(ctx.organization.plan);

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const [clients, usage, recentRuns] = await Promise.all([
    ctx.db.client.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    ctx.db.aiRun.aggregate({
      where: {
        createdAt: { gte: start },
      },
      _sum: { tokensIn: true, tokensOut: true },
    }),
    ctx.db.aiRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        feature: true,
        createdAt: true,
        outputPreview: true,
        tokensIn: true,
        tokensOut: true,
      },
    }),
  ]);

  const tokensUsed = (usage._sum.tokensIn ?? 0) + (usage._sum.tokensOut ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI"
        description="Time-saving assists for staff: client briefs, message drafts, insights, and booking recommendations. AI never books or sends until you confirm."
      />

      <AiWorkbench
        clients={clients}
        providerReady={Boolean(getConfiguredProvider())}
        planAllowsAi={allowsAi}
        planLabel={ctx.organization.plan}
        tokensUsed={tokensUsed}
        tokensLimit={limits.aiTokensPerMonth}
        initialClientId={params.clientId}
        initialIntent={params.intent}
        recentRuns={recentRuns.map((r) => ({
          id: r.id,
          feature: r.feature,
          createdAt: r.createdAt.toISOString(),
          outputPreview: r.outputPreview,
          tokens: r.tokensIn + r.tokensOut,
        }))}
      />
    </div>
  );
}

import "server-only";

import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import {
  generateText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";

import { UserFacingError } from "@/lib/action-errors";
import { env } from "@/lib/env";
import { hashPrompt } from "@/lib/hash";
import { db } from "@/server/db";
import { getPlanLimits, planAllowsAi } from "@/server/billing/plans";

export type AiFeature =
  "client_summary" | "message_draft" | "booking_assistant" | "insight_digest";

export type AiProviderName = "openai" | "google";

export { hashPrompt };

export function getConfiguredProvider(): AiProviderName | null {
  const preferred = env.AI_PROVIDER;
  if (preferred === "openai" && env.OPENAI_API_KEY) return "openai";
  if (preferred === "google" && env.GOOGLE_GENERATIVE_AI_API_KEY)
    return "google";
  if (env.OPENAI_API_KEY) return "openai";
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) return "google";
  return null;
}

export function getLanguageModel(): {
  provider: AiProviderName;
  modelId: string;
  model: LanguageModel;
} {
  const provider = getConfiguredProvider();
  if (!provider) {
    throw new UserFacingError(
      "No AI provider configured. Set OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.",
    );
  }

  if (provider === "openai") {
    return {
      provider,
      modelId: env.AI_MODEL_OPENAI,
      model: openai(env.AI_MODEL_OPENAI),
    };
  }

  return {
    provider,
    modelId: env.AI_MODEL_GOOGLE,
    model: google(env.AI_MODEL_GOOGLE),
  };
}

/** Rough cost estimate in cents for metering dashboards (not billing-grade). */
function estimateCostCents(
  provider: AiProviderName,
  tokensIn: number,
  tokensOut: number,
) {
  const inPerM = provider === "openai" ? 15 : 10;
  const outPerM = provider === "openai" ? 60 : 40;
  return Math.max(
    1,
    Math.round((tokensIn * inPerM + tokensOut * outPerM) / 1_000_000),
  );
}

export async function assertAiBudget(organizationId: string) {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });

  if (!planAllowsAi(org.plan)) {
    throw new UserFacingError(
      `${org.plan} plan does not include AI. Upgrade to Growth or Business.`,
    );
  }

  const limits = getPlanLimits(org.plan);
  if (limits.aiTokensPerMonth == null) {
    return { org, used: 0, limit: null as number | null };
  }

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const aggregates = await db.aiRun.aggregate({
    where: { organizationId, createdAt: { gte: start } },
    _sum: { tokensIn: true, tokensOut: true },
  });

  const used =
    (aggregates._sum.tokensIn ?? 0) + (aggregates._sum.tokensOut ?? 0);

  if (used >= limits.aiTokensPerMonth) {
    throw new UserFacingError(
      `Monthly AI token budget reached (${limits.aiTokensPerMonth.toLocaleString()}). Upgrade or wait until next month.`,
    );
  }

  return { org, used, limit: limits.aiTokensPerMonth };
}

export async function runAiText(input: {
  organizationId: string;
  userId?: string | null;
  feature: AiFeature;
  system: string;
  prompt: string;
  tools?: ToolSet;
  maxSteps?: number;
}) {
  await assertAiBudget(input.organizationId);
  const { provider, modelId, model } = getLanguageModel();

  const result = await generateText({
    model,
    system: input.system,
    prompt: input.prompt,
    tools: input.tools,
    stopWhen: stepCountIs(input.maxSteps ?? (input.tools ? 5 : 1)),
  });

  const tokensIn = result.usage?.inputTokens ?? 0;
  const tokensOut = result.usage?.outputTokens ?? 0;

  await db.aiRun.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      feature: input.feature,
      provider,
      model: modelId,
      tokensIn,
      tokensOut,
      costCents: estimateCostCents(provider, tokensIn, tokensOut),
      inputHash: hashPrompt(`${input.system}\n${input.prompt}`),
      outputPreview: result.text.slice(0, 500),
    },
  });

  return {
    text: result.text,
    provider,
    modelId,
    tokensIn,
    tokensOut,
    steps: result.steps,
  };
}

export async function runAiMessages(input: {
  organizationId: string;
  userId?: string | null;
  feature: AiFeature;
  system: string;
  messages: ModelMessage[];
  tools?: ToolSet;
  maxSteps?: number;
}) {
  await assertAiBudget(input.organizationId);
  const { provider, modelId, model } = getLanguageModel();

  const result = await generateText({
    model,
    system: input.system,
    messages: input.messages,
    tools: input.tools,
    stopWhen: stepCountIs(input.maxSteps ?? (input.tools ? 6 : 1)),
  });

  const tokensIn = result.usage?.inputTokens ?? 0;
  const tokensOut = result.usage?.outputTokens ?? 0;
  const promptFingerprint = JSON.stringify(input.messages).slice(0, 2000);

  await db.aiRun.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      feature: input.feature,
      provider,
      model: modelId,
      tokensIn,
      tokensOut,
      costCents: estimateCostCents(provider, tokensIn, tokensOut),
      inputHash: hashPrompt(`${input.system}\n${promptFingerprint}`),
      outputPreview: result.text.slice(0, 500),
    },
  });

  return {
    text: result.text,
    provider,
    modelId,
    tokensIn,
    tokensOut,
    steps: result.steps,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { err, type ActionResult } from "@/lib/result";
import {
  acceptInviteSchema,
  inviteTeamMemberSchema,
  membershipIdSchema,
  parseForm,
  revokeInviteSchema,
} from "@/server/actions/schemas";
import { requireDbUser, requireMembership } from "@/server/auth/session";
import { assertRateLimit } from "@/server/rate-limit";
import {
  acceptOrganizationInvite,
  createOrganizationInvite,
  provisionChairForMember,
  removeTeamMember,
  revokeOrganizationInvite,
} from "@/server/team/team";
import { rejectIfDemo } from "@/server/demo/guard";
import { isDemoGuest } from "@/server/demo/session";
import {
  getActiveOrganization,
  setActiveOrganizationId,
} from "@/server/tenant/context";

export async function inviteTeamMemberAction(
  formData: FormData,
): Promise<ActionResult<{ inviteId: string; acceptUrl: string }>> {
  const blocked = await rejectIfDemo();
  if (blocked) return blocked;
  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership) {
    return err("No organization selected");
  }
  await requireMembership(ctx.organization.id, "ADMIN");

  const limited = await assertRateLimit({
    name: "team_invite",
    key: `${ctx.organization.id}:${ctx.user.id}`,
    limit: 20,
    windowSec: 60 * 60,
    message: "Too many invites — try again later",
  });
  if (!limited.ok) return err(limited.error);

  const parsed = parseForm(inviteTeamMemberSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const result = await createOrganizationInvite({
    organizationId: ctx.organization.id,
    organizationName: ctx.organization.name,
    actorUserId: ctx.user.id,
    actorRole: ctx.membership.role,
    email: parsed.data.email,
    role: parsed.data.role,
    resourceId: parsed.data.resourceId ?? null,
  });

  if (result.ok) {
    revalidatePath("/dashboard/settings");
    revalidateStaffSurfaces();
  }
  return result;
}

function revalidateStaffSurfaces() {
  revalidatePath("/dashboard/settings/team");
  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/availability");
  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/appointments/new");
  revalidatePath("/dashboard/analytics");
}

export async function removeTeamMemberAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const blocked = await rejectIfDemo();
  if (blocked) return blocked;
  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership) {
    return err("No organization selected");
  }
  await requireMembership(ctx.organization.id, "ADMIN");

  const parsed = parseForm(membershipIdSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const result = await removeTeamMember({
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    actorRole: ctx.membership.role,
    membershipId: parsed.data.membershipId,
  });
  if (result.ok) revalidateStaffSurfaces();
  return result;
}

export async function provisionChairForMemberAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const blocked = await rejectIfDemo();
  if (blocked) return blocked;
  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership) {
    return err("No organization selected");
  }
  await requireMembership(ctx.organization.id, "ADMIN");

  const parsed = parseForm(membershipIdSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const result = await provisionChairForMember({
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    actorRole: ctx.membership.role,
    membershipId: parsed.data.membershipId,
  });
  if (result.ok) revalidateStaffSurfaces();
  return result;
}

export async function revokeInviteAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const blocked = await rejectIfDemo();
  if (blocked) return blocked;
  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership) {
    return err("No organization selected");
  }
  await requireMembership(ctx.organization.id, "ADMIN");

  const parsed = parseForm(revokeInviteSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const result = await revokeOrganizationInvite({
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    actorRole: ctx.membership.role,
    inviteId: parsed.data.inviteId,
  });
  if (result.ok) {
    revalidatePath("/dashboard/settings/team");
  }
  return result;
}

export async function acceptInviteAction(formData: FormData): Promise<void> {
  if (await isDemoGuest()) {
    redirect("/demo");
  }
  const user = await requireDbUser();
  const parsed = parseForm(acceptInviteSchema, formData);
  const token = String(formData.get("token") ?? "");
  if (!parsed.ok) {
    redirect(`/invite/${token}?error=${encodeURIComponent(parsed.error)}`);
  }

  const result = await acceptOrganizationInvite({
    token: parsed.data.token,
    userId: user.id,
    userEmail: user.email,
  });
  if (!result.ok) {
    redirect(
      `/invite/${parsed.data.token}?error=${encodeURIComponent(result.error)}`,
    );
  }

  await setActiveOrganizationId(result.data.organizationId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

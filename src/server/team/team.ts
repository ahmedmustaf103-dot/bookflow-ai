import "server-only";

import { randomBytes } from "node:crypto";

import type { MembershipRole } from "@/generated/prisma/client";
import { toSafeActionError } from "@/lib/action-errors";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { err, ok, type ActionResult } from "@/lib/result";
import { writeAuditLog } from "@/server/billing/entitlements";
import { provisionBookableStaff } from "@/server/catalog/catalog";
import { db } from "@/server/db";
import { sendTeamInviteEmail } from "@/server/notifications/email";
import {
  canAssignInviteRole,
  canRemoveTeamMember,
  normalizeInviteEmail,
} from "./roles";

export {
  INVITEABLE_ROLES,
  canAssignInviteRole,
  canRemoveTeamMember,
  isInviteableRole,
  normalizeInviteEmail,
} from "./roles";
export type { InviteableRole } from "./roles";

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const ROLE_RANK: Record<MembershipRole, number> = {
  VIEWER: 1,
  STAFF: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function chairNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "Staff";
  const name = local
    .replace(/[._+-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
  return name.slice(0, 120) || "Staff";
}

export function inviteAcceptUrl(token: string) {
  const origin = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${origin}/invite/${token}`;
}

export async function peekOrganizationInvite(token: string) {
  const trimmed = token.trim();
  if (!/^[a-f0-9]{64}$/i.test(trimmed)) return null;
  return db.organizationInvite.findUnique({
    where: { token: trimmed },
    select: {
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organization: { select: { name: true } },
    },
  });
}

function newInviteToken() {
  return randomBytes(32).toString("hex");
}

export async function createOrganizationInvite(input: {
  organizationId: string;
  organizationName: string;
  actorUserId: string;
  actorRole: MembershipRole;
  email: string;
  role: MembershipRole;
  resourceId?: string | null;
}): Promise<ActionResult<{ inviteId: string; acceptUrl: string }>> {
  if (!canAssignInviteRole(input.actorRole, input.role)) {
    return err("You cannot invite someone with that role");
  }

  const email = normalizeInviteEmail(input.email);
  if (!email || !email.includes("@")) {
    return err("Enter a valid email");
  }

  const existingMember = await db.membership.findFirst({
    where: {
      organizationId: input.organizationId,
      status: "ACTIVE",
      user: { email: { equals: email, mode: "insensitive" } },
    },
  });
  if (existingMember) {
    return err("That person is already on this team");
  }

  const pending = await db.organizationInvite.findFirst({
    where: {
      organizationId: input.organizationId,
      email,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });
  if (pending) {
    return err("An invite is already pending for that email");
  }

  let resourceId: string | null = null;
  if (input.resourceId) {
    const resource = await db.resource.findFirst({
      where: {
        id: input.resourceId,
        organizationId: input.organizationId,
      },
      select: { id: true },
    });
    if (!resource) return err("Staff member not found");
    resourceId = resource.id;
  } else if (input.role === "STAFF" || input.role === "ADMIN") {
    const chair = await provisionBookableStaff({
      organizationId: input.organizationId,
      name: chairNameFromEmail(email),
      actorId: input.actorUserId,
    });
    if (!chair.ok) return chair;
    resourceId = chair.data.id;
  }

  try {
    const invite = await db.organizationInvite.create({
      data: {
        organizationId: input.organizationId,
        email,
        role: input.role,
        token: newInviteToken(),
        invitedById: input.actorUserId,
        resourceId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    const acceptUrl = inviteAcceptUrl(invite.token);
    try {
      await sendTeamInviteEmail({
        to: email,
        organizationName: input.organizationName,
        role: input.role,
        acceptUrl,
      });
    } catch (e) {
      logger.warn(
        { err: e, to: email },
        "Team invite email failed — invite still created",
      );
      await writeAuditLog({
        organizationId: input.organizationId,
        actorId: input.actorUserId,
        action: "team.invited",
        entityType: "organization_invite",
        entityId: invite.id,
        metadata: { email, role: input.role, emailSent: false },
      });
      return err(
        `${toSafeActionError(e, "The invite email could not be sent")}. The invite is saved — copy the link from Pending invites below.`,
      );
    }

    await writeAuditLog({
      organizationId: input.organizationId,
      actorId: input.actorUserId,
      action: "team.invited",
      entityType: "organization_invite",
      entityId: invite.id,
      metadata: { email, role: input.role },
    });

    return ok({ inviteId: invite.id, acceptUrl });
  } catch (e) {
    return err(toSafeActionError(e, "Unable to send invite"));
  }
}

export async function revokeOrganizationInvite(input: {
  organizationId: string;
  actorUserId: string;
  actorRole: MembershipRole;
  inviteId: string;
}): Promise<ActionResult<{ id: string }>> {
  if (ROLE_RANK[input.actorRole] < ROLE_RANK.ADMIN) {
    return err("Forbidden");
  }

  const invite = await db.organizationInvite.findFirst({
    where: {
      id: input.inviteId,
      organizationId: input.organizationId,
      status: "PENDING",
    },
  });
  if (!invite) return err("Invite not found");

  try {
    await db.organizationInvite.update({
      where: { id: invite.id },
      data: { status: "REVOKED" },
    });
    await writeAuditLog({
      organizationId: input.organizationId,
      actorId: input.actorUserId,
      action: "team.invite_revoked",
      entityType: "organization_invite",
      entityId: invite.id,
    });
    return ok({ id: invite.id });
  } catch (e) {
    return err(toSafeActionError(e, "Unable to revoke invite"));
  }
}

export async function acceptOrganizationInvite(input: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<ActionResult<{ organizationId: string; organizationName: string }>> {
  const token = input.token.trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return err("This invite link is not valid");
  }

  const invite = await db.organizationInvite.findUnique({
    where: { token },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!invite || invite.status === "REVOKED") {
    return err("This invite is no longer valid");
  }
  if (invite.status === "ACCEPTED") {
    const already = await db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invite.organizationId,
          userId: input.userId,
        },
      },
    });
    if (already?.status === "ACTIVE") {
      return ok({
        organizationId: invite.organization.id,
        organizationName: invite.organization.name,
      });
    }
    return err("This invite was already used");
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    return err("This invite has expired. Ask the owner to send a new one.");
  }

  const userEmail = normalizeInviteEmail(input.userEmail);
  if (userEmail !== invite.email) {
    return err(
      `This invite was sent to ${invite.email}. Sign in with that email to join.`,
    );
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId: input.userId,
          },
        },
        create: {
          organizationId: invite.organizationId,
          userId: input.userId,
          role: invite.role,
          status: "ACTIVE",
        },
        update: {
          role: invite.role,
          status: "ACTIVE",
        },
      });
      if (invite.resourceId) {
        const resource = await tx.resource.findFirst({
          where: {
            id: invite.resourceId,
            organizationId: invite.organizationId,
          },
          select: { id: true, userId: true },
        });
        if (
          resource &&
          (resource.userId == null || resource.userId === input.userId)
        ) {
          await tx.resource.update({
            where: { id: resource.id },
            data: { userId: input.userId },
          });
        }
      }
      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
    });

    await writeAuditLog({
      organizationId: invite.organizationId,
      actorId: input.userId,
      action: "team.invite_accepted",
      entityType: "organization_invite",
      entityId: invite.id,
    });

    return ok({
      organizationId: invite.organization.id,
      organizationName: invite.organization.name,
    });
  } catch (e) {
    return err(toSafeActionError(e, "Unable to accept invite"));
  }
}

export async function removeTeamMember(input: {
  organizationId: string;
  actorUserId: string;
  actorRole: MembershipRole;
  membershipId: string;
}): Promise<ActionResult<{ id: string }>> {
  const membership = await db.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId,
      status: "ACTIVE",
    },
    select: { id: true, userId: true, role: true },
  });
  if (!membership) return err("Team member not found");
  if (
    !canRemoveTeamMember(
      input.actorRole,
      membership.role,
      input.actorUserId,
      membership.userId,
    )
  ) {
    return err("You cannot remove that team member");
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: membership.id },
        data: { status: "SUSPENDED" },
      });
      await tx.resource.updateMany({
        where: {
          organizationId: input.organizationId,
          userId: membership.userId,
        },
        data: { userId: null },
      });
      await tx.googleCalendarConnection.deleteMany({
        where: {
          organizationId: input.organizationId,
          userId: membership.userId,
        },
      });
    });
    await writeAuditLog({
      organizationId: input.organizationId,
      actorId: input.actorUserId,
      action: "team.member_removed",
      entityType: "membership",
      entityId: membership.id,
      metadata: { userId: membership.userId, role: membership.role },
    });
    return ok({ id: membership.id });
  } catch (e) {
    return err(toSafeActionError(e, "Unable to remove team member"));
  }
}

export async function provisionChairForMember(input: {
  organizationId: string;
  actorUserId: string;
  actorRole: MembershipRole;
  membershipId: string;
}): Promise<ActionResult<{ id: string }>> {
  if (ROLE_RANK[input.actorRole] < ROLE_RANK.ADMIN) {
    return err("Forbidden");
  }

  const membership = await db.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: input.organizationId,
      status: "ACTIVE",
    },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  });
  if (!membership) return err("Team member not found");

  const existing = await db.resource.findFirst({
    where: {
      organizationId: input.organizationId,
      userId: membership.userId,
    },
    select: { id: true },
  });
  if (existing) return ok({ id: existing.id });

  const name =
    [membership.user.firstName, membership.user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || chairNameFromEmail(membership.user.email);

  return provisionBookableStaff({
    organizationId: input.organizationId,
    name,
    userId: membership.userId,
    actorId: input.actorUserId,
  });
}

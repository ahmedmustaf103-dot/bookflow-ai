import "server-only";

import { randomBytes } from "node:crypto";

import type { MembershipRole } from "@/generated/prisma/client";
import { toSafeActionError } from "@/lib/action-errors";
import { env } from "@/lib/env";
import { err, ok, type ActionResult } from "@/lib/result";
import { writeAuditLog } from "@/server/billing/entitlements";
import { db } from "@/server/db";
import { sendTeamInviteEmail } from "@/server/notifications/email";
import { canAssignInviteRole, normalizeInviteEmail } from "./roles";

export {
  INVITEABLE_ROLES,
  canAssignInviteRole,
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

export function inviteAcceptUrl(token: string) {
  const origin = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${origin}/invite/${token}`;
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

  try {
    const invite = await db.organizationInvite.create({
      data: {
        organizationId: input.organizationId,
        email,
        role: input.role,
        token: newInviteToken(),
        invitedById: input.actorUserId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    const acceptUrl = inviteAcceptUrl(invite.token);
    await sendTeamInviteEmail({
      to: email,
      organizationName: input.organizationName,
      role: input.role,
      acceptUrl,
    });

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

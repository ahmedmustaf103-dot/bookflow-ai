import type { MembershipRole } from "@/generated/prisma/client";

const ROLE_RANK: Record<MembershipRole, number> = {
  VIEWER: 1,
  STAFF: 2,
  ADMIN: 3,
  OWNER: 4,
};

export const INVITEABLE_ROLES = ["ADMIN", "STAFF", "VIEWER"] as const;
export type InviteableRole = (typeof INVITEABLE_ROLES)[number];

export function isInviteableRole(role: string): role is InviteableRole {
  return (INVITEABLE_ROLES as readonly string[]).includes(role);
}

/** Admin+ can invite strictly lower roles. Nobody invites OWNER. Staff cannot invite. */
export function canAssignInviteRole(
  actorRole: MembershipRole,
  targetRole: MembershipRole,
): boolean {
  if (targetRole === "OWNER") return false;
  if (!isInviteableRole(targetRole)) return false;
  if (ROLE_RANK[actorRole] < ROLE_RANK.ADMIN) return false;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

/** Admin+ can remove a strictly lower role. Nobody removes the owner or themselves. */
export function canRemoveTeamMember(
  actorRole: MembershipRole,
  targetRole: MembershipRole,
  actorUserId: string,
  targetUserId: string,
): boolean {
  if (actorUserId === targetUserId) return false;
  if (targetRole === "OWNER") return false;
  if (ROLE_RANK[actorRole] < ROLE_RANK.ADMIN) return false;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

export function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

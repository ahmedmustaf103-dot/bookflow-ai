import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  acceptOrganizationInvite,
  createOrganizationInvite,
  revokeOrganizationInvite,
} from "@/server/team/team";
import { disconnectTestPrisma, getTestPrisma } from "@/test/prisma";
import { resetAndSeedTestOrg, type TestSeed } from "@/test/seed";

describe("team invites (DB)", () => {
  let seed: TestSeed;

  beforeEach(async () => {
    seed = await resetAndSeedTestOrg();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("lets an owner invite staff in their org", async () => {
    const result = await createOrganizationInvite({
      organizationId: seed.organizationId,
      organizationName: "E2E Shop",
      actorUserId: "unused",
      actorRole: "OWNER",
      email: "barber@example.test",
      role: "STAFF",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const db = getTestPrisma();
    const invite = await db.organizationInvite.findUnique({
      where: { id: result.data.inviteId },
    });
    expect(invite?.email).toBe("barber@example.test");
    expect(invite?.role).toBe("STAFF");
    expect(invite?.status).toBe("PENDING");
    expect(invite?.organizationId).toBe(seed.organizationId);
    expect(result.data.acceptUrl).toContain("/invite/");
  });

  it("does not let staff invite members", async () => {
    const result = await createOrganizationInvite({
      organizationId: seed.organizationId,
      organizationName: "E2E Shop",
      actorUserId: "staff",
      actorRole: "STAFF",
      email: "x@example.test",
      role: "VIEWER",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a pending invite into membership for the matching email", async () => {
    const created = await createOrganizationInvite({
      organizationId: seed.organizationId,
      organizationName: "E2E Shop",
      actorUserId: "owner",
      actorRole: "OWNER",
      email: "join@example.test",
      role: "STAFF",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const db = getTestPrisma();
    const invite = await db.organizationInvite.findUniqueOrThrow({
      where: { id: created.data.inviteId },
    });
    const user = await db.user.create({
      data: {
        clerkUserId: `clerk-join-${Date.now()}`,
        email: "join@example.test",
        firstName: "Join",
      },
    });

    const accepted = await acceptOrganizationInvite({
      token: invite.token,
      userId: user.id,
      userEmail: "join@example.test",
    });
    expect(accepted.ok).toBe(true);

    const membership = await db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: seed.organizationId,
          userId: user.id,
        },
      },
    });
    expect(membership?.role).toBe("STAFF");
    expect(membership?.status).toBe("ACTIVE");
  });

  it("rejects accept when the signed-in email does not match", async () => {
    const created = await createOrganizationInvite({
      organizationId: seed.organizationId,
      organizationName: "E2E Shop",
      actorUserId: "owner",
      actorRole: "OWNER",
      email: "right@example.test",
      role: "VIEWER",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const db = getTestPrisma();
    const invite = await db.organizationInvite.findUniqueOrThrow({
      where: { id: created.data.inviteId },
    });
    const user = await db.user.create({
      data: {
        clerkUserId: `clerk-wrong-${Date.now()}`,
        email: "wrong@example.test",
      },
    });

    const accepted = await acceptOrganizationInvite({
      token: invite.token,
      userId: user.id,
      userEmail: "wrong@example.test",
    });
    expect(accepted.ok).toBe(false);
  });

  it("revokes a pending invite so it cannot be accepted", async () => {
    const created = await createOrganizationInvite({
      organizationId: seed.organizationId,
      organizationName: "E2E Shop",
      actorUserId: "owner",
      actorRole: "OWNER",
      email: "gone@example.test",
      role: "STAFF",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const revoked = await revokeOrganizationInvite({
      organizationId: seed.organizationId,
      actorUserId: "owner",
      actorRole: "ADMIN",
      inviteId: created.data.inviteId,
    });
    expect(revoked.ok).toBe(true);

    const db = getTestPrisma();
    const user = await db.user.create({
      data: {
        clerkUserId: `clerk-gone-${Date.now()}`,
        email: "gone@example.test",
      },
    });
    const invite = await db.organizationInvite.findUniqueOrThrow({
      where: { id: created.data.inviteId },
    });
    const accepted = await acceptOrganizationInvite({
      token: invite.token,
      userId: user.id,
      userEmail: "gone@example.test",
    });
    expect(accepted.ok).toBe(false);
  });

  it("links the accepted member to the invited chair", async () => {
    const created = await createOrganizationInvite({
      organizationId: seed.organizationId,
      organizationName: "E2E Shop",
      actorUserId: "owner",
      actorRole: "OWNER",
      email: "chair@example.test",
      role: "STAFF",
      resourceId: seed.resourceId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const db = getTestPrisma();
    const invite = await db.organizationInvite.findUniqueOrThrow({
      where: { id: created.data.inviteId },
    });
    expect(invite.resourceId).toBe(seed.resourceId);

    const user = await db.user.create({
      data: {
        clerkUserId: `clerk-chair-${Date.now()}`,
        email: "chair@example.test",
        firstName: "Chair",
      },
    });
    const accepted = await acceptOrganizationInvite({
      token: invite.token,
      userId: user.id,
      userEmail: "chair@example.test",
    });
    expect(accepted.ok).toBe(true);

    const resource = await db.resource.findUniqueOrThrow({
      where: { id: seed.resourceId },
    });
    expect(resource.userId).toBe(user.id);
  });

  it("does not attach a chair from another organization", async () => {
    const db = getTestPrisma();
    await db.organization.deleteMany({ where: { slug: "invite-other-shop" } });
    const other = await db.organization.create({
      data: {
        name: "Other",
        slug: "invite-other-shop",
        plan: "STARTER",
        timezoneDefault: "UTC",
        locations: { create: { name: "Other", timezone: "UTC" } },
      },
      include: { locations: true },
    });
    const foreign = await db.resource.create({
      data: {
        organizationId: other.id,
        locationId: other.locations[0]!.id,
        name: "Foreign",
        type: "STAFF",
      },
    });

    const result = await createOrganizationInvite({
      organizationId: seed.organizationId,
      organizationName: "E2E Shop",
      actorUserId: "owner",
      actorRole: "OWNER",
      email: "foreign@example.test",
      role: "STAFF",
      resourceId: foreign.id,
    });
    expect(result.ok).toBe(false);

    await db.organization.deleteMany({ where: { slug: "invite-other-shop" } });
  });
});
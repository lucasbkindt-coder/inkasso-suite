const { PrismaClient, MembershipStatus, PermissionScope, RoleKind } = require("@prisma/client");

const prisma = new PrismaClient();

const standardPermissions = [
  ["tenant", "read", PermissionScope.TENANT, "Mandant anzeigen"],
  ["tenant", "update", PermissionScope.TENANT, "Mandant verwalten"],
  ["member", "read", PermissionScope.TENANT, "Mitglieder anzeigen"],
  ["member", "invite", PermissionScope.TENANT, "Mitglieder einladen"],
  ["member", "update", PermissionScope.TENANT, "Mitglieder verwalten"],
  ["member", "assign_role", PermissionScope.TENANT, "Rollen zuweisen"],
  ["team", "read", PermissionScope.TENANT, "Teams anzeigen"],
  ["team", "create", PermissionScope.TENANT, "Teams erstellen"],
  ["team", "update", PermissionScope.TENANT, "Teams verwalten"],
  ["team", "delete", PermissionScope.TENANT, "Teams löschen"],
  ["team", "manage_members", PermissionScope.TENANT, "Teammitglieder verwalten"],
  ["role", "read", PermissionScope.TENANT, "Rollen anzeigen"],
  ["role", "create", PermissionScope.TENANT, "Rollen erstellen"],
  ["role", "update", PermissionScope.TENANT, "Rollen verwalten"],
  ["role", "delete", PermissionScope.TENANT, "Rollen löschen"],
  ["role", "manage_permissions", PermissionScope.TENANT, "Rollenberechtigungen verwalten"],
  ["case", "read", PermissionScope.TENANT, "Fälle anzeigen"],
  ["case", "create", PermissionScope.TENANT, "Fälle erstellen"],
  ["case", "update", PermissionScope.TENANT, "Fälle bearbeiten"],
  ["case", "assign", PermissionScope.TENANT, "Fälle zuweisen"],
  ["debtor", "read", PermissionScope.TENANT, "Schuldner anzeigen"],
  ["debtor", "create", PermissionScope.TENANT, "Schuldner erstellen"],
  ["debtor", "update", PermissionScope.TENANT, "Schuldner bearbeiten"],
  ["claim", "read", PermissionScope.TENANT, "Forderungen anzeigen"],
  ["claim", "create", PermissionScope.TENANT, "Forderungen erstellen"],
  ["claim", "update", PermissionScope.TENANT, "Forderungen bearbeiten"],
  ["payment", "read", PermissionScope.TENANT, "Zahlungen anzeigen"],
  ["payment", "create", PermissionScope.TENANT, "Zahlungen erfassen"],
  ["payment", "update", PermissionScope.TENANT, "Zahlungen bearbeiten"],
  ["document", "read", PermissionScope.TENANT, "Dokumente anzeigen"],
  ["document", "create", PermissionScope.TENANT, "Dokumente hochladen"],
  ["document", "delete", PermissionScope.TENANT, "Dokumente löschen"],
  ["report", "read", PermissionScope.TENANT, "Auswertungen anzeigen"],
  ["settings", "read", PermissionScope.TENANT, "Einstellungen anzeigen"],
  ["settings", "update", PermissionScope.TENANT, "Einstellungen verwalten"]
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "inkasso-suite" },
    update: { deletedAt: null, isActive: true, name: "Inkasso Suite" },
    create: { name: "Inkasso Suite", slug: "inkasso-suite" }
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { deletedAt: null, isActive: true },
    create: { email: "admin@example.com", displayName: "Tenant Owner" }
  });

  const membership = await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: { deletedAt: null, status: MembershipStatus.ACTIVE },
    create: { tenantId: tenant.id, userId: admin.id, status: MembershipStatus.ACTIVE }
  });

  const ownerRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Tenant Owner" } },
    update: {
      deletedAt: null,
      kind: RoleKind.SYSTEM,
      description: "Vollzugriff innerhalb des Mandanten"
    },
    create: {
      tenantId: tenant.id,
      name: "Tenant Owner",
      kind: RoleKind.SYSTEM,
      description: "Vollzugriff innerhalb des Mandanten"
    }
  });

  const permissions = await Promise.all(
    standardPermissions.map(([resource, action, scope, description]) =>
      prisma.permission.upsert({
        where: { resource_action_scope: { resource, action, scope } },
        update: { description },
        create: { resource, action, scope, description }
      })
    )
  );

  await prisma.rolePermission.deleteMany({
    where: {
      roleId: ownerRole.id,
      permissionId: { notIn: permissions.map((permission) => permission.id) }
    }
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: ownerRole.id,
      permissionId: permission.id
    })),
    skipDuplicates: true
  });

  await prisma.membershipRole.upsert({
    where: {
      membershipId_roleId: {
        membershipId: membership.id,
        roleId: ownerRole.id
      }
    },
    update: {},
    create: { membershipId: membership.id, roleId: ownerRole.id }
  });
}

main()
  .then(() => console.info("Database seed completed."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

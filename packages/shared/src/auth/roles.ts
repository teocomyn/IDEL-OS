import { z } from "zod";

export const organizationRoleSchema = z.enum(["owner", "idel", "remplacant", "secretaire"]);
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

const permissions = {
  owner: ["organization.manage", "patient.read", "patient.write", "privacy.export"],
  idel: ["patient.read", "patient.write", "privacy.export"],
  remplacant: ["patient.read", "patient.write"],
  secretaire: ["patient.read", "patient.write"],
} as const satisfies Record<OrganizationRole, readonly string[]>;

export function hasPermission(role: OrganizationRole, permission: string): boolean {
  return permissions[role].includes(permission as never);
}

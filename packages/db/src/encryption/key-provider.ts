export type OrganizationKey = {
  keyId: string;
  key: Buffer;
};

export interface KeyProvider {
  getOrganizationKey(organizationId: string, keyId?: string): Promise<OrganizationKey>;
}

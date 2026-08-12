export type AuthenticatedProfessional = {
  userId: string;
  organizationId: string;
  role: "owner" | "idel" | "remplacant" | "secretaire";
  twoFactorVerified: boolean;
};

export interface AuthProvider {
  getProfessional(headers: Headers): Promise<AuthenticatedProfessional | null>;
  revokeUserSessions(userId: string): Promise<void>;
}

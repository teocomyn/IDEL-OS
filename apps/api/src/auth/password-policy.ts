import { createHash } from "node:crypto";

import { DomainError } from "@idel-os/shared";

export type CompromisedPasswordChecker = (password: string) => Promise<boolean>;

export class PasswordPolicy {
  public constructor(private readonly isCompromised: CompromisedPasswordChecker) {}

  public async assertAllowed(password: string): Promise<void> {
    if (password.length < 12) {
      throw new DomainError(
        "PASSWORD_TOO_SHORT",
        "Votre mot de passe doit contenir au moins 12 caractères.",
      );
    }
    if (password.length > 128) {
      throw new DomainError("PASSWORD_TOO_LONG", "Votre mot de passe est trop long.");
    }
    if (await this.isCompromised(password)) {
      throw new DomainError(
        "PASSWORD_COMPROMISED",
        "Ce mot de passe figure dans une liste de mots de passe compromis.",
      );
    }
  }
}

export const hibpKAnonymityChecker: CompromisedPasswordChecker = async (password) => {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true", "User-Agent": "IDEL-OS-password-policy" },
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) {
    throw new DomainError(
      "PASSWORD_CHECK_UNAVAILABLE",
      "La vérification de sécurité est indisponible. Réessayez dans quelques instants.",
    );
  }
  return (await response.text())
    .split("\n")
    .some((line) => line.split(":", 1)[0]?.trim() === suffix);
};

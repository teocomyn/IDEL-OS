import { DomainError, type StructuredTransmission } from "@idel-os/shared";

/**
 * Contrat d'intégration préparé pour un futur opérateur MSSanté homologué.
 * Aucune implémentation réseau n'est activée dans IDEL OS à ce stade.
 */
export interface MsSanteGateway {
  send(message: MsSanteMessage): Promise<{ providerMessageId: string; acceptedAt: Date }>;
}

export type MsSanteMessage = {
  transmissionId: string;
  recipientAddress: string;
  subject: string;
  body: string;
  metadata: {
    patientId: string;
    visitId: string;
    validatedAt: string;
    validatedByUserId: string;
  };
};

export function prepareMsSanteMessage(input: {
  transmissionId: string;
  patientId: string;
  visitId: string;
  recipientAddress: string;
  structured: StructuredTransmission;
  finalText: string;
  validatedAt: Date | null;
  validatedByUserId: string | null;
}): MsSanteMessage {
  if (input.validatedAt === null || input.validatedByUserId === null) {
    throw new DomainError("MSSANTE_UNVALIDATED", "Seule une transmission validée peut préparer un message MSSanté.");
  }
  if (!input.recipientAddress.toLowerCase().includes("@")) {
    throw new DomainError("MSSANTE_INVALID_RECIPIENT", "Adresse MSSanté destinataire invalide.");
  }
  return {
    transmissionId: input.transmissionId,
    recipientAddress: input.recipientAddress,
    subject: "Transmission infirmière sécurisée",
    body: input.finalText,
    metadata: {
      patientId: input.patientId,
      visitId: input.visitId,
      validatedAt: input.validatedAt.toISOString(),
      validatedByUserId: input.validatedByUserId,
    },
  };
}

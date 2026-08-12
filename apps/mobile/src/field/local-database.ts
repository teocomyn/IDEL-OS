export class EncryptedFieldDatabase {
  public static async open(): Promise<never> {
    throw new Error("Le cache clinique chiffré est disponible dans l’application iOS/Android.");
  }
}

export async function getOrCreateDeviceId(): Promise<never> {
  throw new Error("L’enregistrement sécurisé de l’appareil nécessite iOS ou Android.");
}

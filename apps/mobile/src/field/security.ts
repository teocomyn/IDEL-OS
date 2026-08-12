import * as LocalAuthentication from "expo-local-authentication";

export async function unlockWithBiometrics(): Promise<void> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!hasHardware || !enrolled) {
    throw new Error("Activez Face ID ou l’empreinte digitale pour utiliser le cache de tournée.");
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Déverrouiller ma tournée",
    cancelLabel: "Annuler",
    fallbackLabel: "Code de l’appareil",
    biometricsSecurityLevel: "strong",
  });
  if (!result.success) throw new Error("Authentification biométrique requise.");
}

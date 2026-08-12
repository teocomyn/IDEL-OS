import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";

import { authClient } from "../../src/auth-client";
import { Screen } from "../../src/components/screen";
import { colors } from "../../src/theme";

export default function SetupTotpScreen() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
      if (result.error !== null) {
        setError(result.error.message ?? "Code incorrect ou expiré.");
        return;
      }
      router.replace("/");
    } catch {
      setError("Serveur indisponible. Réessayez dès que le réseau revient.");
    } finally {
      setBusy(false);
    }
  }

  return <Screen><Text style={styles.title}>Code de sécurité</Text><Text style={styles.body}>Saisissez le code à six chiffres de votre application d’authentification.</Text><TextInput accessibilityLabel="Code de vérification" autoFocus keyboardType="number-pad" maxLength={6} onChangeText={(value) => setCode(value.replace(/\D/g, ""))} placeholder="000000" style={styles.input} value={code} />{error === null ? null : <Text style={styles.error}>{error}</Text>}<Pressable accessibilityRole="button" disabled={busy || code.length !== 6} onPress={() => void verify()} style={[styles.button, busy && styles.buttonDisabled]}><Text style={styles.buttonText}>{busy ? "Vérification…" : "Vérifier et ouvrir la tournée"}</Text></Pressable></Screen>;
}

const styles=StyleSheet.create({title:{fontSize:34,fontWeight:"900",color:colors.ink},body:{fontSize:17,lineHeight:25,color:colors.muted},input:{minHeight:64,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:16,fontSize:24,textAlign:"center",letterSpacing:8},error:{color:"#9A3F35",fontSize:14,lineHeight:20},button:{minHeight:56,borderRadius:14,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},buttonDisabled:{opacity:.55},buttonText:{color:"white",fontSize:16,fontWeight:"800"}});

import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { authClient } from "../../src/auth-client";
import { Screen } from "../../src/components/screen";
import { colors } from "../../src/theme";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error !== null) {
        setError(result.error.message ?? "Connexion impossible.");
        return;
      }
      if (result.data !== null && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect === true) {
        router.replace("/(auth)/setup-totp");
        return;
      }
      router.replace("/");
    } catch {
      setError("Serveur indisponible. Vérifiez votre connexion.");
    } finally {
      setBusy(false);
    }
  }

  return <Screen><Text style={styles.title}>Connexion</Text><Text style={styles.body}>Votre second facteur sera demandé après le mot de passe.</Text><View style={styles.form}><TextInput accessibilityLabel="Adresse e-mail" autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="Adresse e-mail" style={styles.input} value={email} /><TextInput accessibilityLabel="Mot de passe" autoComplete="current-password" onChangeText={setPassword} secureTextEntry placeholder="Mot de passe" style={styles.input} value={password} />{error === null ? null : <Text style={styles.error}>{error}</Text>}<Pressable accessibilityRole="button" disabled={busy || email.trim().length === 0 || password.length === 0} onPress={() => void submit()} style={[styles.button, busy && styles.buttonDisabled]}><Text style={styles.buttonText}>{busy ? "Connexion…" : "Continuer"}</Text></Pressable></View></Screen>;
}

const styles=StyleSheet.create({title:{fontSize:36,fontWeight:"900",color:colors.ink},body:{fontSize:17,color:colors.muted},form:{gap:14},input:{minHeight:56,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:16,fontSize:17},error:{color:"#9A3F35",fontSize:14,lineHeight:20},button:{minHeight:56,borderRadius:14,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},buttonDisabled:{opacity:.55},buttonText:{color:"white",fontSize:17,fontWeight:"800"}});

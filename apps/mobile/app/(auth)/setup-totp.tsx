import { Pressable, StyleSheet, Text, TextInput } from "react-native";

import { Screen } from "../../src/components/screen";
import { colors } from "../../src/theme";

export default function SetupTotpScreen() {
  return <Screen><Text style={styles.title}>Sécurisez votre compte</Text><Text style={styles.body}>Scannez le QR code fourni avec votre application d’authentification, puis saisissez le code à six chiffres.</Text><TextInput accessibilityLabel="Code de vérification" keyboardType="number-pad" maxLength={6} placeholder="000000" style={styles.input} /><Pressable accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>Activer la double authentification</Text></Pressable></Screen>;
}

const styles=StyleSheet.create({title:{fontSize:34,fontWeight:"900",color:colors.ink},body:{fontSize:17,lineHeight:25,color:colors.muted},input:{minHeight:64,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:16,fontSize:24,textAlign:"center",letterSpacing:8},button:{minHeight:56,borderRadius:14,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},buttonText:{color:"white",fontSize:16,fontWeight:"800"}});

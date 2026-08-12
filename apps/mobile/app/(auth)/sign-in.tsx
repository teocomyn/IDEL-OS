import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Screen } from "../../src/components/screen";
import { colors } from "../../src/theme";

export default function SignInScreen() {
  return <Screen><Text style={styles.title}>Connexion</Text><Text style={styles.body}>Votre second facteur sera demandé après le mot de passe.</Text><View style={styles.form}><TextInput accessibilityLabel="Adresse e-mail" autoCapitalize="none" keyboardType="email-address" placeholder="Adresse e-mail" style={styles.input} /><TextInput accessibilityLabel="Mot de passe" secureTextEntry placeholder="Mot de passe" style={styles.input} /><Pressable accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>Continuer</Text></Pressable></View></Screen>;
}

const styles=StyleSheet.create({title:{fontSize:36,fontWeight:"900",color:colors.ink},body:{fontSize:17,color:colors.muted},form:{gap:14},input:{minHeight:56,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:16,fontSize:17},button:{minHeight:56,borderRadius:14,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},buttonText:{color:"white",fontSize:17,fontWeight:"800"}});

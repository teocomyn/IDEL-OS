import { Pressable, StyleSheet, Text, TextInput } from "react-native";

import { Screen } from "../../src/components/screen";
import { colors } from "../../src/theme";

export default function NewPatientScreen() {
  return <Screen><Text style={styles.title}>Nouveau patient</Text><Text style={styles.body}>Les champs sensibles sont chiffrés avant synchronisation.</Text>{["Prénom","Nom","Date de naissance","Adresse","Code postal","Ville"].map((label)=><TextInput key={label} accessibilityLabel={label} placeholder={label} style={styles.input} />)}<Pressable accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>Enregistrer</Text></Pressable></Screen>;
}

const styles=StyleSheet.create({title:{fontSize:34,fontWeight:"900",color:colors.ink},body:{fontSize:16,color:colors.muted},input:{minHeight:56,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:16,fontSize:17},button:{minHeight:56,borderRadius:14,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},buttonText:{color:"white",fontSize:17,fontWeight:"800"}});

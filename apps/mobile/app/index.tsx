import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "../src/components/screen";
import { SyncStatus } from "../src/components/sync-status";
import { colors } from "../src/theme";

export default function TodayScreen() {
  return <Screen><View style={styles.header}><View><Text style={styles.eyebrow}>IDEL OS</Text><Text style={styles.title}>Aujourd’hui</Text></View><SyncStatus /></View><View style={styles.card}><Text style={styles.cardTitle}>Aucun passage planifié</Text><Text style={styles.body}>Ajoutez un patient puis scannez une ordonnance pour préparer votre journée.</Text></View><View style={styles.notice}><Text style={styles.noticeText}>Les gains de temps et de cotation apparaissent uniquement lorsqu’ils sont mesurables.</Text></View><Link href="/patients/new" asChild><Pressable accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>Ajouter un patient</Text></Pressable></Link></Screen>;
}

const styles = StyleSheet.create({ header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12},eyebrow:{color:colors.primary,fontWeight:"800",letterSpacing:1},title:{fontSize:38,fontWeight:"900",letterSpacing:-1.5,color:colors.ink},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:20,padding:22,minHeight:180,justifyContent:"center"},cardTitle:{fontSize:24,fontWeight:"800",color:colors.ink},body:{fontSize:17,lineHeight:25,color:colors.muted,marginTop:8},notice:{backgroundColor:colors.info,borderRadius:14,padding:16},noticeText:{fontSize:15,lineHeight:22,color:colors.ink},button:{minHeight:56,borderRadius:14,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center",marginTop:"auto"},buttonText:{color:"white",fontSize:17,fontWeight:"800"} });

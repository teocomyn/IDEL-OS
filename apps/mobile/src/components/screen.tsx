import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";

import { colors } from "../theme";

export function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>{children}</ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { flexGrow: 1, padding: 20, gap: 20 } });

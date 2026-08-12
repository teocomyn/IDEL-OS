import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export function SyncStatus({ pending = 0, online = true }: { pending?: number; online?: boolean | null }) {
  const label = online === false ? `Hors ligne${pending > 0 ? ` · ${pending}` : ""}` : pending === 0 ? "Synchronisé" : `${pending} en attente`;
  return <View accessibilityLiveRegion="polite" style={styles.container}><View style={[styles.dot, online === false && styles.offline]} /><Text style={styles.text}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 56, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 28, backgroundColor: colors.surface },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  offline: { backgroundColor: "#D17A44" },
  text: { color: colors.ink, fontWeight: "700" },
});

import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "../../src/components/screen";
import {
  acknowledgeTransmission,
  fetchTourTransmissionSummary,
  type TransmissionView,
} from "../../src/field/api-client";
import { colors } from "../../src/theme";

export default function TransmissionSummaryScreen() {
  const [items, setItems] = useState<TransmissionView[]>([]);
  const [counts, setCounts] = useState({ unread: 0, pending: 0, signals: 0 });
  const [message, setMessage] = useState("Chargement de la relève…");

  async function load() {
    try {
      const summary = await fetchTourTransmissionSummary(todayInParis());
      setItems(summary.items);
      setCounts({ unread: summary.unreadCount, pending: summary.acknowledgementPendingCount, signals: summary.signalCount });
      setMessage(summary.items.length === 0 ? "Aucune transmission pour votre tournée." : "Résumé destiné à la remplaçante · ouvrez chaque transmission avant accusé.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Résumé indisponible.");
    }
  }

  useEffect(() => { void load(); }, []);

  return <Screen>
    <View><Text style={styles.eyebrow}>RELÈVE DE TOURNÉE</Text><Text style={styles.title}>À savoir aujourd’hui</Text><Text style={styles.subtitle}>{message}</Text></View>
    <View style={styles.metrics}>
      <Metric value={counts.unread} label="non lues" />
      <Metric value={counts.pending} label="à confirmer" />
      <Metric value={counts.signals} label="signalements" alert={counts.signals > 0} />
    </View>
    {items.map((item) => <View key={item.id} style={[styles.card, item.structured.concerns.some(({ urgency }) => urgency === "a_signaler") && styles.alertCard]}>
      <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
      <Text style={styles.copy}>{item.finalText}</Text>
      <View style={styles.actions}>
        {item.receipt?.readAt == null ? <Pressable style={styles.lightButton} onPress={() => void acknowledgeTransmission(item.id, "read").then(load)}><Text style={styles.lightText}>Marquer lue</Text></Pressable> : null}
        {item.receipt?.acknowledgedAt == null ? <Pressable style={styles.primaryButton} onPress={() => void acknowledgeTransmission(item.id, "acknowledge").then(load)}><Text style={styles.primaryText}>Prise en compte</Text></Pressable> : <Text style={styles.acknowledged}>✓ Prise en compte</Text>}
      </View>
    </View>)}
  </Screen>;
}

function Metric({ value, label, alert = false }: { value: number; label: string; alert?: boolean }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, alert && styles.alertText]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}
function todayInParis() { return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

const styles = StyleSheet.create({
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -1.2, marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  metrics: { flexDirection: "row", padding: 8, borderRadius: 18, backgroundColor: colors.ink },
  metric: { flex: 1, alignItems: "center", paddingVertical: 13 },
  metricValue: { color: "white", fontSize: 24, fontWeight: "900" },
  metricLabel: { color: "#AAC0C2", fontSize: 10, marginTop: 3 },
  alertText: { color: "#FF988E" },
  card: { padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 19, backgroundColor: colors.surface },
  alertCard: { borderColor: "#D48272" },
  date: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  copy: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 9 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  lightButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: colors.info },
  lightText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  primaryButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: colors.primary },
  primaryText: { color: "white", fontWeight: "900", fontSize: 12 },
  acknowledged: { color: "#17633F", fontWeight: "800", fontSize: 12 },
});

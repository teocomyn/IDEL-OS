import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "../../src/components/screen";
import {
  applyOptimization,
  proposeOptimization,
  type OptimizationProposal,
} from "../../src/field/api-client";
import { colors } from "../../src/theme";

export default function OptimizeTourScreen() {
  const [proposal, setProposal] = useState<OptimizationProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("OSRM calcule les vrais temps routiers, puis VROOM propose une répartition multi-IDEL.");

  async function propose() {
    setBusy(true);
    try {
      const next = await proposeOptimization(todayInParis());
      setProposal(next);
      setMessage("Aucun changement n’a été appliqué. Vérifiez le diff ci-dessous.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Optimisation indisponible.");
    } finally { setBusy(false); }
  }

  async function apply() {
    if (proposal === null) return;
    setBusy(true);
    try {
      const applied = await applyOptimization(proposal.optimizationRunId);
      setProposal(applied);
      setMessage("Nouvelle tournée appliquée explicitement. Les écrans Aujourd’hui peuvent maintenant se resynchroniser.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Application impossible.");
    } finally { setBusy(false); }
  }

  return <Screen>
    <View><Text style={styles.eyebrow}>OPTIMISATION TERRAIN</Text><Text style={styles.title}>Prévisualiser avant d’appliquer</Text><Text style={styles.subtitle}>{message}</Text></View>
    <View style={styles.rule}><Text style={styles.ruleTitle}>Règle de sécurité</Text><Text style={styles.ruleText}>L’optimiseur ne modifie jamais la tournée seul. Les horaires impératifs, compétences, continuité, pauses, laboratoire et retours cabinet sont transmis comme contraintes.</Text></View>
    <Pressable disabled={busy || proposal?.accepted === true} style={styles.proposeButton} onPress={() => void propose()}><Text style={styles.proposeText}>{busy ? "Calcul en cours…" : proposal === null ? "Calculer une proposition" : "Recalculer la proposition"}</Text></Pressable>
    {proposal !== null ? <>
      <View style={styles.metrics}>
        <Metric label="Temps" before={formatDuration(proposal.diff.before.durationS)} after={formatDuration(proposal.diff.after.durationS)} />
        <Metric label="Distance" before={formatDistance(proposal.diff.before.distanceM)} after={formatDistance(proposal.diff.after.distanceM)} />
        <Metric label="Écart charge" before={String(proposal.diff.before.loadImbalance)} after={String(proposal.diff.after.loadImbalance)} />
        <Metric label="Continuité" before={String(proposal.diff.before.continuityBreaks)} after={String(proposal.diff.after.continuityBreaks)} />
      </View>
      <View style={styles.card}><Text style={styles.sectionTitle}>{proposal.diff.moved.length} changement(s) proposé(s)</Text>
        {proposal.diff.moved.length === 0 ? <Text style={styles.body}>La tournée actuelle est déjà optimale avec ces contraintes.</Text> : proposal.diff.moved.map((move) => <View key={move.stopId} style={styles.diffRow}><Text style={styles.stopId}>{move.stopId.slice(0, 8)}</Text><Text style={styles.diffText}>{move.fromPosition === null ? "Nouveau" : `#${move.fromPosition + 1}`} → #{move.toPosition + 1}{move.fromNurseId !== move.toNurseId ? " · change d’IDEL" : ""}</Text></View>)}
      </View>
      <View style={styles.gainCard}><Text style={styles.gainLabel}>GAIN ESTIMÉ</Text><Text style={styles.gainValue}>{formatDuration(proposal.diff.gains.durationS)} · {formatDistance(proposal.diff.gains.distanceM)}</Text></View>
      {!proposal.accepted ? <Pressable disabled={busy} style={styles.applyButton} onPress={() => void apply()}><Text style={styles.applyText}>Appliquer exactement ces changements</Text></Pressable> : <View style={styles.applied}><Text style={styles.appliedText}>✓ Proposition appliquée</Text></View>}
    </> : null}
  </Screen>;
}

function Metric({ label, before, after }: { label: string; before: string; after: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.before}>{before}</Text><Text style={styles.arrow}>↓</Text><Text style={styles.after}>{after}</Text></View>; }
function todayInParis() { return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function formatDuration(value: number) { const sign = value < 0 ? "−" : ""; const total = Math.abs(Math.round(value / 60)); return `${sign}${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")}`; }
function formatDistance(value: number) { return `${value < 0 ? "−" : ""}${(Math.abs(value) / 1_000).toFixed(1)} km`; }

const styles = StyleSheet.create({
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -1.2, marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  rule: { padding: 17, borderRadius: 17, backgroundColor: colors.info },
  ruleTitle: { color: colors.primary, fontWeight: "900" },
  ruleText: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 5 },
  proposeButton: { minHeight: 54, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primary, borderRadius: 14 },
  proposeText: { color: colors.primary, fontSize: 15, fontWeight: "900" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { width: "48%", padding: 15, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  before: { color: colors.muted, fontSize: 14, textDecorationLine: "line-through", marginTop: 8 },
  arrow: { color: colors.primary, fontWeight: "900", marginVertical: 1 },
  after: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  card: { padding: 18, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 8 },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  diffRow: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  stopId: { color: colors.ink, fontWeight: "800" },
  diffText: { color: colors.muted, fontSize: 12 },
  gainCard: { padding: 18, borderRadius: 17, backgroundColor: colors.ink },
  gainLabel: { color: "#AAC0C2", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  gainValue: { color: "white", fontSize: 22, fontWeight: "900", marginTop: 5 },
  applyButton: { minHeight: 58, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#17633F" },
  applyText: { color: "white", fontSize: 15, fontWeight: "900" },
  applied: { padding: 17, alignItems: "center", borderRadius: 14, backgroundColor: "#DFF2E8" },
  appliedText: { color: "#17633F", fontWeight: "900" },
});

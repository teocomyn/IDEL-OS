import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { structureFrenchTransmission, type StructuredTransmission } from "@idel-os/shared";

import { Screen } from "../../src/components/screen";
import {
  acknowledgeTransmission,
  createTransmissionDraft,
  fetchHandover,
  type TransmissionView,
  validateTransmission,
} from "../../src/field/api-client";
import { colors } from "../../src/theme";

export default function VoiceTransmissionScreen() {
  const params = useLocalSearchParams<{ visitId: string; patientId: string; patientName?: string }>();
  const [transcript, setTranscript] = useState("");
  const [structured, setStructured] = useState<StructuredTransmission | null>(null);
  const [history, setHistory] = useState<TransmissionView[]>([]);
  const [recording, setRecording] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState("Prête à enregistrer. La transcription reste locale sur l’appareil.");
  const [busy, setBusy] = useState(false);
  const startedAt = useRef<number | null>(null);
  const durationS = useRef<number | null>(null);

  useSpeechRecognitionEvent("start", () => setRecording(true));
  useSpeechRecognitionEvent("end", () => setRecording(false));
  useSpeechRecognitionEvent("result", (event) => {
    const next = event.results[0]?.transcript?.trim();
    if (next !== undefined && next.length > 0) setTranscript(next);
  });
  useSpeechRecognitionEvent("error", (event) => {
    setRecording(false);
    setMessage(event.error === "language-not-supported"
      ? "Le modèle français hors ligne n’est pas installé. Vous pouvez saisir la transmission au clavier."
      : "Transcription locale indisponible. Aucun vocal n’a été envoyé sur Internet : saisissez le texte au clavier.");
  });

  useEffect(() => {
    if (params.patientId === undefined) return;
    void fetchHandover(params.patientId)
      .then(async (items) => {
        setHistory(items);
        await Promise.all(items.filter(({ receipt }) => receipt?.readAt == null)
          .map(({ id }) => acknowledgeTransmission(id, "read")));
      })
      .catch(() => setMessage("La relève précédente sera rechargée dès que la connexion reviendra."));
  }, [params.patientId]);

  const sourceCounts = useMemo(() => structured === null ? null : ({
    observed: structured.observations.filter(({ source }) => source === "observed").length,
    reported: structured.observations.filter(({ source }) => source === "reported").length,
    notMeasured: structured.observations.filter(({ source }) => source === "not_measured").length,
  }), [structured]);

  async function startVoice(): Promise<void> {
    if (Platform.OS === "web") {
      setMessage("La dictée web est désactivée pour éviter tout moteur vocal cloud. Utilisez le clavier ou l’application iOS/Android.");
      return;
    }
    const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permissions.granted) {
      setMessage("Autorisez le microphone pour dicter, ou utilisez le clavier.");
      return;
    }
    startedAt.current = Date.now();
    setDraftId(null);
    setStructured(null);
    setMessage("Enregistrement en cours · dites explicitement « observé », « rapporté » ou « non mesuré ».");
    ExpoSpeechRecognitionModule.start({
      lang: "fr-FR",
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: true,
      recordingOptions: { persist: false },
    });
  }

  function stopVoice(): void {
    ExpoSpeechRecognitionModule.stop();
    durationS.current = startedAt.current === null ? null : Math.max(1, Math.round((Date.now() - startedAt.current) / 1_000));
    startedAt.current = null;
    setMessage("Relisez le texte, corrigez-le, puis préparez la transmission structurée.");
  }

  function prepare(): void {
    if (transcript.trim().length === 0) {
      setMessage("Dictez ou saisissez une transmission avant de continuer.");
      return;
    }
    try {
      setStructured(structureFrenchTransmission(transcript, new Date()));
      setDraftId(null);
      setMessage("Correction obligatoire : vérifiez chaque information avant de créer le brouillon.");
    } catch {
      setMessage("Le texte ne peut pas encore être structuré. Corrigez-le puis réessayez.");
    }
  }

  async function createDraft(): Promise<void> {
    if (structured === null || params.patientId === undefined || params.visitId === undefined) return;
    setBusy(true);
    try {
      const created = await createTransmissionDraft({
        transmissionId: Crypto.randomUUID(),
        patientId: params.patientId,
        visitId: params.visitId,
        rawTranscript: transcript,
        structured,
        audioDurationS: durationS.current,
        transcriptionMode: Platform.OS === "web" ? "manual" : "on_device",
      });
      setDraftId(created.id);
      setMessage("Brouillon chiffré enregistré. Rien n’est clinique tant que vous ne validez pas ci-dessous.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création du brouillon impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function validate(): Promise<void> {
    if (draftId === null) return;
    setBusy(true);
    try {
      await validateTransmission(draftId);
      setMessage("Transmission validée, historisée et disponible dans la relève.");
      router.back();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Validation impossible.");
    } finally {
      setBusy(false);
    }
  }

  return <Screen>
    <View><Text style={styles.eyebrow}>TRANSMISSION DU PASSAGE</Text><Text style={styles.title}>{params.patientName ?? "Patient"}</Text><Text style={styles.subtitle}>Depuis mon dernier passage</Text></View>

    {history.length === 0 ? <View style={styles.infoCard}><Text style={styles.infoTitle}>Aucune nouvelle relève</Text><Text style={styles.body}>Vous êtes à jour pour ce patient.</Text></View> : history.map((item) =>
      <View key={item.id} style={styles.historyCard}>
        <Text style={styles.historyDate}>{formatDateTime(item.createdAt)}</Text>
        <Text style={styles.historyText}>{item.finalText}</Text>
        <Pressable style={styles.ackButton} onPress={() => void acknowledgeTransmission(item.id, "acknowledge").then(() => setHistory((current) => current.filter(({ id }) => id !== item.id)))}><Text style={styles.ackText}>J’ai pris en compte</Text></Pressable>
      </View>,
    )}

    <View style={styles.recorderCard}>
      <View style={[styles.dot, recording && styles.dotLive]} />
      <Text style={styles.recorderTitle}>{recording ? "Enregistrement en cours" : "Transmission vocale"}</Text>
      <Text style={styles.body}>Sur iPhone/Android, IDEL OS exige la reconnaissance hors ligne. En cas d’indisponibilité, aucun repli cloud n’est effectué.</Text>
      <Pressable style={[styles.recordButton, recording && styles.stopButton]} onPress={() => recording ? stopVoice() : void startVoice()}><Text style={styles.recordText}>{recording ? "Arrêter" : "Démarrer le vocal"}</Text></Pressable>
    </View>

    <View style={styles.editorCard}>
      <Text style={styles.sectionTitle}>1. Corriger la transcription</Text>
      <TextInput
        multiline
        value={transcript}
        onChangeText={(value) => { setTranscript(value); setStructured(null); setDraftId(null); }}
        placeholder="Ex. Observé : tension 128/72. La patiente rapporte une douleur EVA 3. Saturation non mesurée…"
        placeholderTextColor="#859497"
        style={styles.textArea}
      />
      <Pressable disabled={recording} style={styles.secondaryButton} onPress={prepare}><Text style={styles.secondaryText}>Structurer localement</Text></Pressable>
    </View>

    {structured !== null ? <View style={styles.editorCard}>
      <Text style={styles.sectionTitle}>2. Vérifier chaque catégorie</Text>
      <View style={styles.badges}><Badge label={`${sourceCounts?.observed ?? 0} observé`} /><Badge label={`${sourceCounts?.reported ?? 0} rapporté`} /><Badge label={`${sourceCounts?.notMeasured ?? 0} non mesuré`} /></View>
      {structured.observations.map((observation, index) => <View key={`${observation.text}-${index}`} style={styles.structuredRow}>
        <Pressable onPress={() => setStructured((current) => current === null ? null : ({
          ...current,
          observations: current.observations.map((item, itemIndex) => itemIndex === index ? { ...item, source: nextSource(item.source) } : item),
        }))}><Text style={styles.sourceLabel}>{sourceLabel(observation.source)}</Text></Pressable>
        <TextInput
          multiline
          value={observation.text}
          onChangeText={(text) => setStructured((current) => current === null ? null : ({
            ...current,
            observations: current.observations.map((item, itemIndex) => itemIndex === index ? { ...item, text } : item),
          }))}
          style={styles.rowInput}
        />
      </View>)}
      {structured.actsPerformed.length > 0 ? <View style={styles.summaryBlock}><Text style={styles.sourceLabel}>ACTES DÉTECTÉS</Text>{structured.actsPerformed.map(({ label }, index) => <Text key={`${label}-${index}`} style={styles.summaryLine}>• {label}</Text>)}</View> : null}
      {structured.vitals.map((vital, index) => <View key={`${vital.type}-${index}`} style={styles.vitalRow}><Text style={styles.vitalName}>{vital.type.replaceAll("_", " ")}</Text><TextInput keyboardType="decimal-pad" value={String(vital.value)} onChangeText={(value) => setStructured((current) => current === null || !Number.isFinite(Number(value.replace(",", "."))) ? current : ({ ...current, vitals: current.vitals.map((item, itemIndex) => itemIndex === index ? { ...item, value: Number(value.replace(",", ".")) } : item) }))} style={styles.vitalInput} /><Text style={styles.unit}>{vital.unit}</Text></View>)}
      {structured.concerns.length > 0 ? <View style={styles.concernBlock}><Text style={styles.concernTitle}>POINTS DE VIGILANCE</Text>{structured.concerns.map(({ text, urgency }, index) => <Text key={`${text}-${index}`} style={styles.summaryLine}>• {text} · {urgency.replaceAll("_", " ")}</Text>)}</View> : null}
      {structured.nextVisitNotes !== null ? <View style={styles.summaryBlock}><Text style={styles.sourceLabel}>PROCHAIN PASSAGE</Text><Text style={styles.summaryLine}>{structured.nextVisitNotes}</Text></View> : null}
      <Text style={styles.warning}>La validation engage la responsabilité professionnelle. Vérifiez les actes, constantes, sources et points de vigilance.</Text>
      {draftId === null ? <Pressable disabled={busy} style={styles.primaryButton} onPress={() => void createDraft()}><Text style={styles.primaryText}>{busy ? "Enregistrement…" : "Créer le brouillon vérifié"}</Text></Pressable> : <Pressable disabled={busy} style={styles.validateButton} onPress={() => void validate()}><Text style={styles.primaryText}>{busy ? "Validation…" : "Valider définitivement"}</Text></Pressable>}
    </View> : null}

    <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View>
  </Screen>;
}

function nextSource(source: "observed" | "reported" | "not_measured") {
  return source === "observed" ? "reported" : source === "reported" ? "not_measured" : "observed";
}

function sourceLabel(source: "observed" | "reported" | "not_measured") {
  return source === "observed" ? "OBSERVÉ" : source === "reported" ? "RAPPORTÉ" : "NON MESURÉ";
}

function Badge({ label }: { label: string }) { return <View style={styles.badge}><Text style={styles.badgeText}>{label}</Text></View>; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

const styles = StyleSheet.create({
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4 },
  infoCard: { padding: 18, borderRadius: 18, backgroundColor: colors.info },
  infoTitle: { color: colors.ink, fontWeight: "800", fontSize: 16 },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  historyCard: { padding: 17, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  historyDate: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  historyText: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 8 },
  ackButton: { minHeight: 40, marginTop: 12, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.info },
  ackText: { color: colors.primary, fontWeight: "800" },
  recorderCard: { padding: 20, borderRadius: 22, backgroundColor: colors.ink },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#708386" },
  dotLive: { backgroundColor: "#FF7568" },
  recorderTitle: { color: "white", fontSize: 22, fontWeight: "900", marginTop: 10 },
  recordButton: { minHeight: 52, marginTop: 18, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primary },
  stopButton: { backgroundColor: "#A8463B" },
  recordText: { color: "white", fontWeight: "900", fontSize: 15 },
  editorCard: { padding: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 12 },
  textArea: { minHeight: 150, padding: 14, borderRadius: 13, backgroundColor: colors.canvas, color: colors.ink, fontSize: 15, lineHeight: 22, textAlignVertical: "top" },
  secondaryButton: { minHeight: 48, marginTop: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primary, borderRadius: 12 },
  secondaryText: { color: colors.primary, fontWeight: "900" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, backgroundColor: colors.info },
  badgeText: { color: colors.primary, fontSize: 10, fontWeight: "800" },
  structuredRow: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border },
  sourceLabel: { color: colors.primary, fontSize: 10, fontWeight: "900", marginBottom: 5 },
  rowInput: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  vitalRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border },
  summaryBlock: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border },
  summaryLine: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 3 },
  concernBlock: { padding: 12, borderRadius: 11, backgroundColor: "#FFF0EC", marginTop: 10 },
  concernTitle: { color: "#8B3F34", fontSize: 10, fontWeight: "900" },
  vitalName: { flex: 1, color: colors.ink, fontWeight: "700", textTransform: "capitalize" },
  vitalInput: { width: 72, padding: 8, borderRadius: 9, backgroundColor: colors.canvas, color: colors.ink, textAlign: "right", fontWeight: "800" },
  unit: { width: 50, color: colors.muted },
  warning: { color: "#794B20", backgroundColor: "#FFF4E4", padding: 12, borderRadius: 11, fontSize: 12, lineHeight: 18, marginTop: 12 },
  primaryButton: { minHeight: 54, marginTop: 14, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.primary },
  validateButton: { minHeight: 56, marginTop: 14, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#17633F" },
  primaryText: { color: "white", fontSize: 15, fontWeight: "900" },
  message: { padding: 14, borderRadius: 13, backgroundColor: colors.info },
  messageText: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: "600" },
});

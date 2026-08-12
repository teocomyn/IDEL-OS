import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionQueue,
  InMemoryOfflineTourStorage,
  InMemoryQueueStorage,
  OfflineTourController,
  SyncEngine,
  type OfflineTourStorage,
  type OfflineVisit,
  type QueueStorage,
} from "@idel-os/sync";

import { Screen } from "../src/components/screen";
import { SyncStatus } from "../src/components/sync-status";
import { colors } from "../src/theme";
import { authClient } from "../src/auth-client";
import { deliverAction, enforceRemoteWipe, fetchToday, registerDevice } from "../src/field/api-client";
import { EncryptedFieldDatabase, getOrCreateDeviceId } from "../src/field/local-database";
import { unlockWithBiometrics } from "../src/field/security";

type LocalStore = QueueStorage & OfflineTourStorage;

class InMemoryFieldStore implements LocalStore {
  private readonly queue = new InMemoryQueueStorage();
  private readonly tour = new InMemoryOfflineTourStorage();
  public list() { return this.queue.list(); }
  public put(action: Parameters<InMemoryQueueStorage["put"]>[0]) { return this.queue.put(action); }
  public get(id: string) { return this.queue.get(id); }
  public listVisits() { return this.tour.listVisits(); }
  public getVisit(id: string) { return this.tour.getVisit(id); }
  public putVisit(visit: OfflineVisit) { return this.tour.putVisit(visit); }
  public replaceVisits(visits: OfflineVisit[]) { return this.tour.replaceVisits(visits); }
  public purge() { return this.tour.purge(); }
}

export default function TodayScreen() {
  const session = authClient.useSession();
  useEffect(() => {
    if (!session.isPending && session.data === null) router.replace("/(auth)/sign-in");
  }, [session.data, session.isPending]);
  if (session.isPending || session.data === null) {
    return <Screen><View style={styles.empty}><Text style={styles.emptyTitle}>Ouverture de la session sécurisée…</Text></View></Screen>;
  }
  return <FieldTodayScreen />;
}

function FieldTodayScreen() {
  const [visits, setVisits] = useState<OfflineVisit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState<boolean | null>(null);
  const [message, setMessage] = useState("Déverrouillage sécurisé…");
  const [ready, setReady] = useState(false);
  const controllerRef = useRef<OfflineTourController | null>(null);
  const queueRef = useRef<ActionQueue | null>(null);
  const syncRef = useRef<SyncEngine | null>(null);

  const refreshLocalState = useCallback(async () => {
    const controller = controllerRef.current;
    const queue = queueRef.current;
    if (controller === null || queue === null) return;
    const [nextVisits, actions] = await Promise.all([controller.list(), queue.replayable()]);
    setVisits(nextVisits);
    setPending(actions.length);
    setSelectedId((current) => current ?? nextVisits.find(({ status }) => status !== "done")?.id ?? null);
  }, []);

  const synchronize = useCallback(async () => {
    const engine = syncRef.current;
    const controller = controllerRef.current;
    if (engine === null || controller === null) return;
    const result = await engine.flush();
    if (result.failed > 0) {
      setMessage("Mode hors ligne · vos actions restent chiffrées sur ce téléphone.");
      await refreshLocalState();
      return;
    }
    try {
      const remote = await fetchToday(todayInParis());
      await controller.hydrate(remote);
      setMessage("Tournée synchronisée sans perte.");
    } catch {
      setMessage("Actions envoyées. Actualisation serveur à reprendre.");
    }
    await refreshLocalState();
  }, [refreshLocalState]);

  useEffect(() => {
    let mounted = true;
    let subscription: { remove(): void } | null = null;
    let wipeTimer: ReturnType<typeof setInterval> | null = null;
    async function bootstrap() {
      try {
        if (Platform.OS !== "web") await unlockWithBiometrics();
        const store: LocalStore = Platform.OS === "web"
          ? new InMemoryFieldStore()
          : await EncryptedFieldDatabase.open();
        if (!mounted) return;
        const queue = new ActionQueue(store);
        const controller = new OfflineTourController(store, queue, () => Crypto.randomUUID());
        queueRef.current = queue;
        controllerRef.current = controller;
        syncRef.current = new SyncEngine(queue, deliverAction);

        const network = await Network.getNetworkStateAsync();
        const isOnline = network.isConnected === true && network.isInternetReachable !== false;
        setOnline(isOnline);
        if (isOnline) {
          try {
            if (Platform.OS !== "web") {
              const deviceId = await getOrCreateDeviceId();
              await registerDevice({
                deviceId,
                label: `${Platform.OS === "ios" ? "iPhone" : "Android"} IDEL OS`,
                platform: Platform.OS === "ios" ? "ios" : "android",
              });
              const handleRemoteWipe = async () => {
                const wiped = await enforceRemoteWipe(deviceId, async () => {
                  await store.purge();
                  if (!mounted) return;
                  controllerRef.current = null;
                  queueRef.current = null;
                  syncRef.current = null;
                  setVisits([]);
                  setReady(false);
                  setMessage("Ce téléphone a été purgé à distance. Reconnectez-vous.");
                });
                return wiped;
              };
              const wiped = await handleRemoteWipe();
              if (wiped) {
                return;
              }
              wipeTimer = setInterval(() => { void handleRemoteWipe().catch(() => undefined); }, 60_000);
            }
            await synchronize();
          } catch {
            const cached = await controller.list();
            setVisits(cached);
            setMessage(cached.length > 0 ? "Mode hors ligne · tournée chargée depuis le cache chiffré." : "Connexion à l’API nécessaire pour charger la première tournée.");
          }
        } else {
          await refreshLocalState();
          setMessage("Mode avion · toutes les actions seront synchronisées au retour du réseau.");
        }
        setReady(true);
        subscription = Network.addNetworkStateListener((state) => {
          const reachable = state.isConnected === true && state.isInternetReachable !== false;
          setOnline(reachable);
          if (reachable) void synchronize();
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Impossible d’ouvrir la tournée sécurisée.");
      }
    }
    void bootstrap();
    return () => {
      mounted = false;
      subscription?.remove();
      if (wipeTimer !== null) clearInterval(wipeTimer);
    };
  }, [refreshLocalState, synchronize]);

  const act = useCallback(async (operation: (controller: OfflineTourController) => Promise<OfflineVisit>) => {
    const controller = controllerRef.current;
    if (controller === null) return;
    try {
      await operation(controller);
      await refreshLocalState();
      if (online === true) await synchronize();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.");
    }
  }, [online, refreshLocalState, synchronize]);

  const selected = visits.find(({ id }) => id === selectedId) ?? null;
  const completed = visits.filter(({ status }) => status === "done").length;
  const nextVisit = visits.find(({ status }) => status === "planned" || status === "in_progress");

  return (
    <Screen>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>IDEL OS · TERRAIN</Text><Text style={styles.title}>Aujourd’hui</Text><Text style={styles.date}>{formatDate(new Date())}</Text></View>
        <SyncStatus pending={pending} online={online} />
      </View>

      <View style={styles.progressCard}>
        <View><Text style={styles.progressValue}>{completed}/{visits.length}</Text><Text style={styles.progressLabel}>passages terminés</Text></View>
        <View style={styles.progressDivider} />
        <View><Text style={styles.progressValue}>{nextVisit === undefined ? "—" : formatTime(nextVisit.estimatedArrivalAt)}</Text><Text style={styles.progressLabel}>prochaine arrivée recalculée</Text></View>
      </View>

      <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View>

      <View style={styles.quickActions}>
        <Pressable style={styles.quickAction} onPress={() => router.push("/transmissions/summary")}><Text style={styles.quickActionLabel}>Relève de tournée</Text><Text style={styles.quickActionHint}>Lu, accusés et alertes →</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={() => router.push("/tour/optimize")}><Text style={styles.quickActionLabel}>Optimiser</Text><Text style={styles.quickActionHint}>Voir le diff avant →</Text></Pressable>
      </View>

      {!ready && visits.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Ouverture du coffre local…</Text><Text style={styles.body}>La biométrie protège la clé SQLCipher de votre tournée.</Text></View> : null}
      {ready && visits.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Aucun passage chargé</Text><Text style={styles.body}>Connectez-vous une première fois avant de partir en tournée. Le mode avion sera ensuite disponible.</Text></View> : null}

      {visits.length > 0 ? <View style={styles.list}>
        {visits.map((visit, index) => <Pressable key={visit.id} onPress={() => setSelectedId(visit.id)} style={[styles.visitCard, selectedId === visit.id && styles.visitCardSelected]}>
          <View style={styles.visitTime}><Text style={styles.visitTimeText}>{formatTime(visit.estimatedArrivalAt)}</Text><Text style={styles.visitIndex}>{String(index + 1).padStart(2, "0")}</Text></View>
          <View style={styles.visitCopy}><Text style={styles.visitName}>{visit.patientDisplayName}</Text><Text style={styles.visitAddress} numberOfLines={1}>{visit.address}</Text><Text style={styles.visitActs}>{visit.acts.length} acte{visit.acts.length > 1 ? "s" : ""} · {visit.estimatedDurationMin} min</Text></View>
          <StatusPill status={visit.status} />
        </Pressable>)}
      </View> : null}

      {selected !== null ? <View style={styles.detailCard}>
        <Text style={styles.detailKicker}>PASSAGE SÉLECTIONNÉ</Text>
        <Text style={styles.detailTitle}>{selected.patientDisplayName}</Text>
        <Text style={styles.body}>{selected.address}</Text>
        <Pressable style={styles.mapButton} onPress={() => void openNavigation(selected.address)}><Text style={styles.mapButtonText}>Ouvrir l’itinéraire</Text></Pressable>
        <Pressable style={styles.transmissionButton} onPress={() => router.push({ pathname: "/transmissions/[visitId]", params: { visitId: selected.id, patientId: selected.patientId, patientName: selected.patientDisplayName } })}><Text style={styles.transmissionButtonText}>Dicter la transmission</Text></Pressable>

        <Text style={styles.sectionTitle}>Checklist des actes</Text>
        {selected.acts.map((item) => <Pressable
          key={item.id}
          disabled={selected.status !== "in_progress"}
          onPress={() => void act((controller) => controller.setActPerformed(selected.id, item.id, !item.performed))}
          style={[styles.checkRow, item.performed && styles.checkRowDone]}
        ><View style={[styles.checkbox, item.performed && styles.checkboxDone]}><Text style={styles.checkmark}>{item.performed ? "✓" : ""}</Text></View><Text style={styles.checkLabel}>{item.label}</Text></Pressable>)}

        {selected.status === "planned" ? <Pressable style={styles.primaryButton} onPress={() => void act((controller) => controller.start(selected.id))}><Text style={styles.primaryButtonText}>Démarrer le passage</Text></Pressable> : null}
        {selected.status === "in_progress" ? <Pressable style={styles.primaryButton} onPress={() => void act((controller) => controller.complete(selected.id))}><Text style={styles.primaryButtonText}>Terminer le passage</Text></Pressable> : null}

        {selected.status === "planned" || selected.status === "in_progress" ? <>
          <Text style={styles.sectionTitle}>Exception terrain</Text>
          <View style={styles.exceptionGrid}>
            <ExceptionButton label="Absent" onPress={() => void act((controller) => controller.recordException(selected.id, "absence", null))} />
            <ExceptionButton label="Refus" onPress={() => void act((controller) => controller.recordException(selected.id, "refusal", null))} />
            <ExceptionButton label="Hospitalisé" onPress={() => void act((controller) => controller.recordException(selected.id, "hospitalization", null))} />
            <ExceptionButton label="Urgence" urgent onPress={() => void act((controller) => controller.recordException(selected.id, "emergency", null))} />
            <ExceptionButton label="Reporter +1 h" onPress={() => void act((controller) => controller.recordException(selected.id, "reschedule", null, new Date(Date.now() + 3_600_000).toISOString()))} />
          </View>
        </> : null}
      </View> : null}
    </Screen>
  );
}

function StatusPill({ status }: { status: OfflineVisit["status"] }) {
  const labels: Record<OfflineVisit["status"], string> = { planned: "À faire", in_progress: "En cours", done: "Fait", missed: "Absent", cancelled: "Annulé", refused: "Refus" };
  return <View style={[styles.status, status === "done" && styles.statusDone, status === "in_progress" && styles.statusActive]}><Text style={styles.statusText}>{labels[status]}</Text></View>;
}

function ExceptionButton({ label, onPress, urgent = false }: { label: string; onPress: () => void; urgent?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.exceptionButton, urgent && styles.exceptionUrgent]}><Text style={[styles.exceptionText, urgent && styles.exceptionUrgentText]}>{label}</Text></Pressable>;
}

async function openNavigation(address: string): Promise<void> {
  const encoded = encodeURIComponent(address);
  const url = Platform.OS === "ios" ? `https://maps.apple.com/?daddr=${encoded}&dirflg=d` : `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
  await Linking.openURL(url);
}

function todayInParis(): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(value));
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(value);
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  eyebrow: { color: colors.primary, fontWeight: "900", fontSize: 11, letterSpacing: 1.3 },
  title: { fontSize: 40, fontWeight: "900", letterSpacing: -1.8, color: colors.ink, marginTop: 3 },
  date: { color: colors.muted, fontSize: 15, textTransform: "capitalize" },
  progressCard: { padding: 18, flexDirection: "row", alignItems: "center", borderRadius: 20, backgroundColor: colors.ink },
  progressValue: { color: "white", fontSize: 22, fontWeight: "900" },
  progressLabel: { color: "#AFC4C5", fontSize: 11, marginTop: 2 },
  progressDivider: { width: 1, height: 38, backgroundColor: "#365155", marginHorizontal: 20 },
  message: { padding: 13, borderRadius: 13, backgroundColor: colors.info },
  messageText: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  quickActions: { flexDirection: "row", gap: 9 },
  quickAction: { flex: 1, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  quickActionLabel: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  quickActionHint: { color: colors.primary, fontSize: 10, fontWeight: "700", marginTop: 4 },
  empty: { minHeight: 190, padding: 22, justifyContent: "center", borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 5 },
  list: { gap: 9 },
  visitCard: { minHeight: 86, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface },
  visitCardSelected: { borderColor: colors.primary, backgroundColor: "#F1F9F7" },
  visitTime: { width: 52, alignItems: "center" },
  visitTimeText: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  visitIndex: { color: colors.muted, fontWeight: "800", fontSize: 10, marginTop: 5 },
  visitCopy: { flex: 1, minWidth: 0 },
  visitName: { color: colors.ink, fontWeight: "800", fontSize: 16 },
  visitAddress: { color: colors.muted, fontSize: 12, marginTop: 3 },
  visitActs: { color: colors.primary, fontSize: 11, fontWeight: "700", marginTop: 5 },
  status: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99, backgroundColor: "#EDF1F0" },
  statusDone: { backgroundColor: "#DBF1E9" },
  statusActive: { backgroundColor: "#D8EEEF" },
  statusText: { color: colors.ink, fontSize: 9, fontWeight: "800" },
  detailCard: { padding: 20, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  detailKicker: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  detailTitle: { color: colors.ink, fontSize: 25, fontWeight: "900", letterSpacing: -.5, marginTop: 5 },
  mapButton: { minHeight: 45, marginTop: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primary, borderRadius: 12 },
  mapButtonText: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  transmissionButton: { minHeight: 48, marginTop: 8, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.ink },
  transmissionButtonText: { color: "white", fontWeight: "900", fontSize: 14 },
  sectionTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 22, marginBottom: 9 },
  checkRow: { minHeight: 54, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 12, backgroundColor: "#F4F7F6", marginBottom: 7 },
  checkRowDone: { backgroundColor: "#E4F4EF" },
  checkbox: { width: 25, height: 25, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: "white" },
  checkboxDone: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { color: "white", fontWeight: "900" },
  checkLabel: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700" },
  primaryButton: { minHeight: 56, marginTop: 12, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primary },
  primaryButtonText: { color: "white", fontSize: 16, fontWeight: "900" },
  exceptionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exceptionButton: { minHeight: 42, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: "white" },
  exceptionText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  exceptionUrgent: { borderColor: "#D48272", backgroundColor: "#FFF0EC" },
  exceptionUrgentText: { color: "#8B3F34" },
});

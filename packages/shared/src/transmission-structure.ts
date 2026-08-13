import {
  structuredTransmissionSchema,
  type StructuredTransmission,
  type TransmissionVital,
} from "./schemas/transmission.js";

type VitalRule = {
  type: TransmissionVital["type"];
  pattern: RegExp;
  unit: string;
  parse(match: RegExpMatchArray): { value: number; value2: number | null };
};

const vitalRules: VitalRule[] = [
  { type: "tension", pattern: /(?:tension|ta)\s*(?:à|de|:)?\s*(\d{2,3})\s*[/-]\s*(\d{1,3})/i, unit: "mmHg", parse: (match) => normalizeBloodPressure(Number(match[1]), Number(match[2])) },
  { type: "glycemie", pattern: /glyc(?:é|e)mie\s*(?:à|de|:)?\s*(\d+(?:[,.]\d+)?)\s*(g\/l|mg\/dl|mmol\/l)?/i, unit: "g/L", parse: (match) => ({ value: frenchNumber(match[1]), value2: null }) },
  { type: "temperature", pattern: /temp(?:é|e)rature\s*(?:à|de|:)?\s*(\d{2}(?:[,.]\d+)?)\s*(?:°\s*c|degr(?:é|e)s?)?/i, unit: "°C", parse: (match) => ({ value: frenchNumber(match[1]), value2: null }) },
  { type: "spo2", pattern: /(?:spo2|saturation)\s*(?:à|de|:)?\s*(\d{2,3})\s*%?/i, unit: "%", parse: (match) => ({ value: Number(match[1]), value2: null }) },
  { type: "eva", pattern: /(?:eva|douleur)\s*(?:à|de|:)?\s*(\d{1,2})(?:\s*\/\s*10)?/i, unit: "/10", parse: (match) => ({ value: Number(match[1]), value2: null }) },
  { type: "frequence_cardiaque", pattern: /(?:fr(?:é|e)quence cardiaque|pouls|fc)\s*(?:à|de|:)?\s*(\d{2,3})/i, unit: "bpm", parse: (match) => ({ value: Number(match[1]), value2: null }) },
  { type: "poids", pattern: /poids\s*(?:à|de|:)?\s*(\d{2,3}(?:[,.]\d+)?)\s*kg?/i, unit: "kg", parse: (match) => ({ value: frenchNumber(match[1]), value2: null }) },
];

/** Structuration locale déterministe : aucune donnée ne quitte l'appareil. */
export function structureFrenchTransmission(rawTranscript: string, measuredAt = new Date()): StructuredTransmission {
  const sentences = rawTranscript
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  const vitals: TransmissionVital[] = [];
  const observations: StructuredTransmission["observations"] = [];
  const concerns: StructuredTransmission["concerns"] = [];
  const actsPerformed: StructuredTransmission["actsPerformed"] = [];
  const missingInfo: string[] = [];
  let nextVisitNotes: string | null = null;

  for (const sentence of sentences) {
    const source = classifySource(sentence);
    if (source === "not_measured") missingInfo.push(sentence);
    observations.push({ text: stripSourcePrefix(sentence), source });
    for (const rule of vitalRules) {
      const match = sentence.match(rule.pattern);
      if (match === null || source === "not_measured") continue;
      const values = rule.parse(match);
      vitals.push({
        type: rule.type,
        ...values,
        unit: match[2]?.toLowerCase() === "mg/dl" ? "mg/dL" : rule.unit,
        source: source === "reported" ? "reported" : "observed",
        measuredAt: measuredAt.toISOString(),
      });
    }
    if (/(pansement|injection|prélèvement|toilette|perfusion).*(réalis|fait|effectu)/i.test(sentence)) {
      actsPerformed.push({ label: stripSourcePrefix(sentence), conformToProtocol: null });
    }
    if (/(urgence|médecin|alerte|aggrav|chute|dyspn|confusion)/i.test(sentence)) {
      concerns.push({ text: stripSourcePrefix(sentence), urgency: /urgence|15|samu/i.test(sentence) ? "a_signaler" : "a_surveiller" });
    }
    if (/(prochain passage|à prévoir|demain|ce soir)/i.test(sentence)) nextVisitNotes = stripSourcePrefix(sentence);
  }
  return structuredTransmissionSchema.parse({
    actsPerformed,
    observations,
    vitals: deduplicateVitals(vitals),
    concerns,
    nextVisitNotes,
    missingInfo,
  });
}

function classifySource(sentence: string): "observed" | "reported" | "not_measured" {
  if (/(non mesur|pas mesur|non relev|pas relev|impossible de mesurer)/i.test(sentence)) return "not_measured";
  if (/(patient|patiente|aidant|famille|fille|fils|conjoint).*(dit|signale|rapporte|déclare)|selon (?:le|la) patient/i.test(sentence)) return "reported";
  return "observed";
}

function stripSourcePrefix(sentence: string): string {
  return sentence.replace(/^(?:observé|rapporté|non mesuré)\s*[:-]\s*/i, "").trim();
}

function normalizeBloodPressure(first: number, second: number): { value: number; value2: number } {
  return first < 30 && second < 20
    ? { value: first * 10, value2: second * 10 }
    : { value: first, value2: second };
}

function frenchNumber(value: string | undefined): number {
  return Number((value ?? "0").replace(",", "."));
}

function deduplicateVitals(vitals: TransmissionVital[]): TransmissionVital[] {
  const latest = new Map<TransmissionVital["type"], TransmissionVital>();
  for (const vital of vitals) latest.set(vital.type, vital);
  return [...latest.values()];
}

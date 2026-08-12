const redactedPayloadBrand: unique symbol = Symbol("idel-os.redacted-payload");

export type PhiKind =
  | "PATIENT"
  | "PRESCRIBER"
  | "ADDRESS"
  | "PHONE"
  | "EMAIL"
  | "NIR"
  | "IDENTIFIER";

export type ExplicitPhi = {
  kind: PhiKind;
  value: string;
};

export type RedactionEntry = {
  token: string;
  kind: PhiKind;
  original: string;
};

/** Seul ce type nominal peut franchir la passerelle IA. */
export type RedactedPayload<T> = {
  readonly [redactedPayloadBrand]: true;
  readonly data: T;
  readonly redactionCount: number;
  readonly createdAt: string;
};

export type RedactionResult<T> = {
  payload: RedactedPayload<T>;
  /** À conserver exclusivement dans le périmètre HDS chiffré. */
  vault: RedactionEntry[];
};

const automaticPatterns: ReadonlyArray<{ kind: PhiKind; pattern: RegExp }> = [
  { kind: "EMAIL", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu },
  { kind: "PHONE", pattern: /(?<!\d)(?:(?:\+33|0033)[ .-]?[1-9]|0[1-9])(?:[ .-]?\d{2}){4}(?!\d)/gu },
  { kind: "NIR", pattern: /(?<!\d)[12]\s?\d{2}\s?(?:0[1-9]|1[0-2])\s?(?:2[AB]|\d{2})\s?\d{3}\s?\d{3}\s?\d{2}(?!\d)/gu },
];

export function redactForAi<T>(input: T, explicitPhi: ExplicitPhi[] = []): RedactionResult<T> {
  const vault: RedactionEntry[] = [];
  const counters = new Map<PhiKind, number>();
  const tokenByOriginal = new Map<string, string>();

  const replace = (original: string, kind: PhiKind): string => {
    const key = `${kind}:${normalize(original)}`;
    const existing = tokenByOriginal.get(key);
    if (existing !== undefined) return existing;
    const index = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, index);
    const token = `[${kind}_${index}]`;
    tokenByOriginal.set(key, token);
    vault.push({ token, kind, original });
    return token;
  };

  const redactString = (value: string): string => {
    let output = value;
    const sortedExplicit = [...explicitPhi]
      .filter(({ value: candidate }) => candidate.trim().length >= 2)
      .sort((left, right) => right.value.length - left.value.length);
    for (const phi of sortedExplicit) {
      output = output.replace(new RegExp(escapeRegex(phi.value), "giu"), (match) => replace(match, phi.kind));
    }
    for (const { kind, pattern } of automaticPatterns) {
      output = output.replace(pattern, (match) => replace(match, kind));
    }
    return output;
  };

  const data = mapStrings(input, redactString);
  return {
    payload: {
      [redactedPayloadBrand]: true,
      data,
      redactionCount: vault.length,
      createdAt: new Date().toISOString(),
    },
    vault,
  };
}

export function isRedactedPayload(value: unknown): value is RedactedPayload<unknown> {
  return typeof value === "object" && value !== null && redactedPayloadBrand in value;
}

export function assertNoObviousPhi(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const { kind, pattern } of automaticPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(serialized)) throw new Error(`Donnée de santé non pseudonymisée détectée (${kind}).`);
  }
}

function mapStrings<T>(value: T, transform: (input: string) => string): T {
  return mapUnknown(value, transform) as T;
}

function mapUnknown(value: unknown, transform: (input: string) => string): unknown {
  if (typeof value === "string") return transform(value);
  if (Array.isArray(value)) return value.map((item: unknown) => mapUnknown(item, transform));
  if (typeof value !== "object" || value === null) return value;
  const mapped = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, mapUnknown(item, transform)]),
  );
  return mapped;
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("fr-FR");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

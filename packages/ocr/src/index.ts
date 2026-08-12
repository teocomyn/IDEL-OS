export type SupportedDocumentMime = "image/jpeg" | "image/png" | "application/pdf";

export type CaptureMetrics = {
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  /** Variance du Laplacien calculée localement, avant tout envoi. */
  laplacianVariance?: number;
  /** Proportion de pixels presque blancs, entre 0 et 1. */
  glareRatio?: number;
  /** Proportion du cadre occupée par le document, entre 0 et 1. */
  documentCoverage?: number;
};

export type QualityIssueCode =
  | "UNSUPPORTED_FORMAT"
  | "FILE_TOO_LARGE"
  | "IMAGE_TOO_SMALL"
  | "IMAGE_BLURRY"
  | "EXCESSIVE_GLARE"
  | "DOCUMENT_BADLY_FRAMED";

export type QualityIssue = {
  code: QualityIssueCode;
  severity: "blocking" | "warning";
  message: string;
};

export type CaptureQuality = {
  accepted: boolean;
  score: number;
  issues: QualityIssue[];
};

const supportedMimeTypes = new Set<SupportedDocumentMime>([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

export function assessCaptureQuality(metrics: CaptureMetrics): CaptureQuality {
  const issues: QualityIssue[] = [];
  if (!supportedMimeTypes.has(metrics.mimeType as SupportedDocumentMime)) {
    issues.push({
      code: "UNSUPPORTED_FORMAT",
      severity: "blocking",
      message: "Utilisez une photo JPEG/PNG ou un document PDF.",
    });
  }
  if (metrics.sizeBytes > 15 * 1024 * 1024) {
    issues.push({
      code: "FILE_TOO_LARGE",
      severity: "blocking",
      message: "Le document dépasse la limite de 15 Mo.",
    });
  }

  if (metrics.mimeType !== "application/pdf") {
    if ((metrics.width ?? 0) < 1_000 || (metrics.height ?? 0) < 1_000) {
      issues.push({
        code: "IMAGE_TOO_SMALL",
        severity: "blocking",
        message: "Rapprochez-vous : l’ordonnance doit faire au moins 1 000 px de côté.",
      });
    }
    if (metrics.laplacianVariance !== undefined && metrics.laplacianVariance < 65) {
      issues.push({
        code: "IMAGE_BLURRY",
        severity: "blocking",
        message: "La photo est trop floue. Stabilisez le téléphone et reprenez-la.",
      });
    }
    if (metrics.glareRatio !== undefined && metrics.glareRatio > 0.32) {
      issues.push({
        code: "EXCESSIVE_GLARE",
        severity: metrics.glareRatio > 0.45 ? "blocking" : "warning",
        message: "Un reflet masque probablement une partie de l’ordonnance.",
      });
    }
    if (metrics.documentCoverage !== undefined && metrics.documentCoverage < 0.55) {
      issues.push({
        code: "DOCUMENT_BADLY_FRAMED",
        severity: "warning",
        message: "Recadrez le document pour qu’il occupe davantage l’image.",
      });
    }
  }

  const penalty = issues.reduce(
    (total, issue) => total + (issue.severity === "blocking" ? 35 : 12),
    0,
  );
  return {
    accepted: !issues.some(({ severity }) => severity === "blocking"),
    score: Math.max(0, 100 - penalty),
    issues,
  };
}

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExtractedField = {
  id: string;
  path: string;
  label: string;
  value: string;
  confidence: number;
  page: number;
  boundingBox?: BoundingBox | undefined;
  sourceText: string;
  needsReview: boolean;
};

export type PrescriptionExtraction = {
  provider: string;
  providerVersion: string;
  rawText: string;
  fields: ExtractedField[];
  overallConfidence: number;
  requiresHumanReview: true;
};

export type OcrDocument = {
  objectKey: string;
  mimeType: SupportedDocumentMime;
  pageCount: number;
};

export interface PrescriptionOcrProvider {
  extract(document: OcrDocument): Promise<PrescriptionExtraction>;
}

export function normalizeExtraction(
  extraction: Omit<PrescriptionExtraction, "overallConfidence" | "requiresHumanReview">,
  reviewThreshold = 0.92,
): PrescriptionExtraction {
  const fields = extraction.fields.map((field) => ({
    ...field,
    confidence: clampConfidence(field.confidence),
    needsReview: field.needsReview || field.confidence < reviewThreshold,
  }));
  const overallConfidence = fields.length === 0
    ? 0
    : fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length;
  return {
    ...extraction,
    fields,
    overallConfidence,
    // Une ordonnance ne devient jamais valide sur la seule décision d'un moteur OCR.
    requiresHumanReview: true,
  };
}

export type FieldReview = {
  fieldId: string;
  correctedValue: string;
  confirmed: boolean;
};

export function assertExtractionFullyReviewed(
  extraction: PrescriptionExtraction,
  reviews: FieldReview[],
): void {
  const reviewByField = new Map(reviews.map((review) => [review.fieldId, review]));
  const missing = extraction.fields.filter((field) => !reviewByField.get(field.id)?.confirmed);
  if (missing.length > 0) {
    throw new Error(`Relecture incomplète : ${missing.map(({ label }) => label).join(", ")}.`);
  }
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

import {
  assertNoObviousPhi,
  isRedactedPayload,
  type RedactedPayload,
} from "@idel-os/phi-redaction";

export type AiPurpose = "prescription_structure" | "transmission_structure" | "coding_assistance";

export type AiRequest<T> = {
  purpose: AiPurpose;
  promptVersion: string;
  payload: RedactedPayload<T>;
};

export type AiProviderResponse<T> = {
  output: T;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

export type AiResponse<T> = AiProviderResponse<T> & {
  latencyMs: number;
  redactionCount: number;
};

export interface AiProvider {
  complete<TInput, TOutput>(request: AiRequest<TInput>): Promise<AiProviderResponse<TOutput>>;
}

export class SafeAiGateway {
  public constructor(private readonly provider: AiProvider) {}

  public async complete<TInput, TOutput>(request: AiRequest<TInput>): Promise<AiResponse<TOutput>> {
    if (!isRedactedPayload(request.payload)) {
      throw new Error("La passerelle IA refuse tout payload non pseudonymisé.");
    }
    assertNoObviousPhi(request.payload.data);
    const startedAt = performance.now();
    const response = await this.provider.complete<TInput, TOutput>(request);
    return {
      ...response,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      redactionCount: request.payload.redactionCount,
    };
  }
}

/** Fournisseur déterministe réservé aux tests et aux démonstrations synthétiques. */
export class FixtureAiProvider implements AiProvider {
  public constructor(private readonly fixture: unknown) {}

  public async complete<TInput, TOutput>(request: AiRequest<TInput>): Promise<AiProviderResponse<TOutput>> {
    void request;
    return Promise.resolve({
      output: structuredClone(this.fixture) as TOutput,
      model: "fixture-no-network",
      tokensIn: 0,
      tokensOut: 0,
    });
  }
}

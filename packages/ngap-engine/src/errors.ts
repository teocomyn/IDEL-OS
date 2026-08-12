export class NgapInputError extends Error {
  public readonly code = "INVALID_CONTEXT";

  public constructor(message: string) {
    super(message);
    this.name = "NgapInputError";
  }
}

export class NgapConfigurationError extends Error {
  public readonly code = "UNVERIFIED_ACTIVE_RULES";

  public constructor(public readonly entryIds: readonly string[]) {
    super(`Active NGAP entries require review: ${entryIds.join(", ")}`);
    this.name = "NgapConfigurationError";
  }
}

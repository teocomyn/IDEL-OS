export type ConflictInput = {
  resource: "patient" | "visit" | "coding" | "transmission";
  localVersion: number;
  serverVersion: number;
  validated?: boolean;
};

export type ConflictResolution = "local" | "server" | "create_version";

export function resolveConflict(input: ConflictInput): ConflictResolution {
  if (
    input.validated === true &&
    (input.resource === "coding" || input.resource === "transmission")
  ) {
    return "create_version";
  }
  return input.localVersion > input.serverVersion ? "local" : "server";
}

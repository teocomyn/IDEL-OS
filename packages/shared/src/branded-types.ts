export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type OrganizationId = Brand<string, "OrganizationId">;
export type UserId = Brand<string, "UserId">;
export type PatientId = Brand<string, "PatientId">;
export type EncryptedValue = Brand<string, "EncryptedValue">;

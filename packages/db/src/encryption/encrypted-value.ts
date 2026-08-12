import type { EncryptedValue } from "@idel-os/shared";

export function asEncryptedValue(value: string): EncryptedValue {
  return value as EncryptedValue;
}

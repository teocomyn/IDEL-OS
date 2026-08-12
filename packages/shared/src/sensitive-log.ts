const forbiddenKeyPattern =
  /patient|first.?name|last.?name|birth|nir|address|phone|email|prescription|transcript|notes?/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const frenchPhonePattern = /\b(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}\b/;
const nirPattern = /\b[12]\d{2}(?:0[1-9]|1[0-2])\d{2}\d{3}\d{3}\d{2}\b/;

export function containsSensitiveData(value: string): boolean {
  return emailPattern.test(value) || frenchPhonePattern.test(value) || nirPattern.test(value);
}

export function sanitizeLogContext(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeLogContext);
  }
  if (value === null || typeof value !== "object") {
    return typeof value === "string" && containsSensitiveData(value) ? "[REDACTED]" : value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      forbiddenKeyPattern.test(key) ? "[REDACTED]" : sanitizeLogContext(child),
    ]),
  );
}

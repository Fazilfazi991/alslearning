export type ManagedRole = "teacher" | "student";
export const validAccountId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const validAccountName = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= 120;
export const validAccountEmail = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const validAccountPassword = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 10 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^a-zA-Z0-9\s]/.test(value);
export const passwordHelp = "Use 10–128 characters, including uppercase, lowercase, a number and a symbol.";
export const isManagedRole = (value: unknown): value is ManagedRole => value === "teacher" || value === "student";

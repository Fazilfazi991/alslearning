// Explicit zone keeps server HTML and browser hydration identical near midnight.
export function academicDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Dubai" }).format(new Date(value));
}

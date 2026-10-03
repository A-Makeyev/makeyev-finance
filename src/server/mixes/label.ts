/**
 * Mix-name comparison, shared by the repo (which refuses a duplicate) and the
 * unit tests. Case-insensitive and trimmed: "First Home", "first home" and
 * "  First Home  " are one and the same name to a reader, so they must be the
 * same name to the cap of four slots.
 */
export function normalizeMixLabel(label: string): string {
  return label.trim().toLocaleLowerCase()
}

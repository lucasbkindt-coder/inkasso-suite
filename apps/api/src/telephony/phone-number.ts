const NON_DIALABLE = /[^\d+]/g;

export function normalizeGermanPhoneNumber(input: string): string | null {
  const compact = input.trim().replace(NON_DIALABLE, "");
  if (!compact) return null;
  let normalized = compact;
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;
  else if (normalized.startsWith("0")) normalized = `+49${normalized.slice(1)}`;
  else if (!normalized.startsWith("+")) normalized = `+49${normalized}`;
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) return null;
  return normalized;
}

export type IconTone = "sage" | "pine" | "eucalyptus" | "seafoam" | "steel" | "mauve-gray";

export const iconTones: IconTone[] = ["sage", "pine", "eucalyptus", "seafoam", "steel", "mauve-gray"];

export function iconToneForLabel(input: string): IconTone {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return "sage";

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }

  return iconTones[hash % iconTones.length];
}

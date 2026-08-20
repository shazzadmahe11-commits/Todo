export const PRESET_CATEGORIES = ["work", "personal", "groceries"] as const;
export type PresetCategory = (typeof PRESET_CATEGORIES)[number];

const PRESET_COLORS: Record<PresetCategory, string> = {
  work:      "#3b82f6",
  personal:  "#a855f7",
  groceries: "#f59e0b",
};

const CUSTOM_PALETTE = ["#ef4444","#14b8a6","#ec4899","#84cc16","#06b6d4","#f97316","#6366f1","#22c55e"];

export function categoryColor(category: string | null | undefined): string {
  const key = (category || "personal").trim().toLowerCase();
  if ((PRESET_CATEGORIES as readonly string[]).includes(key)) return PRESET_COLORS[key as PresetCategory];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return CUSTOM_PALETTE[hash % CUSTOM_PALETTE.length];
}

export function categoryLabel(category: string | null | undefined): string {
  const key = (category || "personal").trim();
  if (!key) return "Personal";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function groupTasksByCategory<T extends { category: string | null }>(list: T[]): { category: string; tasks: T[] }[] {
  const map = new Map<string, T[]>();
  for (const t of list) {
    const key = t.category || "personal";
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  const order: string[] = [...PRESET_CATEGORIES];
  const keys = Array.from(map.keys());
  keys.sort((a, b) => {
    const ai = order.indexOf(a.toLowerCase()), bi = order.indexOf(b.toLowerCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
  return keys.map(k => ({ category: k, tasks: map.get(k)! }));
}

// Returns custom category names from tasks (not presets)
export function extractCustomCategories(tasks: { category: string | null }[]): string[] {
  const presets = PRESET_CATEGORIES as readonly string[];
  const seen = new Set<string>();
  for (const t of tasks) {
    const key = (t.category || "personal").trim().toLowerCase();
    if (!presets.includes(key) && key) seen.add(t.category!.trim());
  }
  return Array.from(seen).sort();
}

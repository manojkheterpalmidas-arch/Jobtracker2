import type { MidasKeywordMode } from "@/lib/types";

export const defaultMidasKeywords = [
  "MIDAS",
  "MIDAS Civil",
  "MIDAS Gen",
  "MIDAS GTS",
  "MIDAS FEA",
  "Civil NX",
  "Gen NX",
  "GTS NX",
  "FEA NX",
  "midas Civil",
  "midas Gen",
  "midas GTS",
  "midas FEA",
  "midas nGen",
  "nGen",
  "midas Design+",
  "midas Drawing"
];

export function selectedMidasKeywords(mode: MidasKeywordMode, customKeywords: string[] = []) {
  const custom = customKeywords.map((keyword) => keyword.trim()).filter(Boolean);
  const keywords =
    mode === "custom"
      ? custom
      : mode === "default_plus_custom"
        ? [...defaultMidasKeywords, ...custom]
        : defaultMidasKeywords;

  return Array.from(new Set(keywords));
}

export function isSpecificMidasProduct(keyword: string) {
  return /midas\s+(civil|gen|gts|fea|ngen|design|drawing)|\b(civil|gen|gts|fea)\s*nx\b|\bngen\b/i.test(keyword);
}

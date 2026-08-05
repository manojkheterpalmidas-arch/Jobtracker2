import { isSpecificMidasProduct } from "@/lib/midasKeywords";
import type { LushaContact, MidasMentionDetection } from "@/lib/types";

type FieldText = {
  field: string;
  text: string;
};

const profileFieldPriority = [
  "skills",
  "linkedinSkills",
  "certifications",
  "courses",
  "experience",
  "experiences",
  "summary",
  "headline",
  "description"
];

function flattenValue(value: unknown, field: string, output: FieldText[]) {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    if (text) output.push({ field, text });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenValue(item, `${field}[${index}]`, output));
    return;
  }

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      flattenValue(item, field ? `${field}.${key}` : key, output);
    });
  }
}

function fieldWeight(field: string) {
  const normalized = field.toLowerCase();
  const index = profileFieldPriority.findIndex((item) => normalized.includes(item.toLowerCase()));
  return index === -1 ? 99 : index;
}

function keywordPattern(keyword: string) {
  const normalized = keyword.trim();

  if (/^(civil|gen|gts|fea)\s+nx$/i.test(normalized)) {
    const [prefix] = normalized.split(/\s+/);
    return new RegExp(`\\b${prefix}\\s*nx\\b`, "i");
  }

  if (/^midas$/i.test(normalized)) {
    return /\bmidas\b/i;
  }

  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

function snippet(text: string, pattern: RegExp) {
  const match = pattern.exec(text);
  const index = match?.index ?? 0;
  const start = Math.max(0, index - 55);
  const end = Math.min(text.length, index + 95);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

function confidenceForMatch(fields: string[], matchedKeywords: string[]): MidasMentionDetection["confidence"] {
  const fieldText = fields.join(" ").toLowerCase();
  const hasSpecificProduct = matchedKeywords.some(isSpecificMidasProduct);

  if (
    hasSpecificProduct ||
    /skills|certifications|courses|experience|experiences/.test(fieldText)
  ) {
    return "high";
  }

  if (/summary|headline|description/.test(fieldText)) {
    return "medium";
  }

  return "low";
}

export function flattenLushaProfileFields(contact: LushaContact) {
  const fields: FieldText[] = [];
  flattenValue(contact, "", fields);
  return fields
    .filter((item) => item.text.length > 1)
    .sort((a, b) => fieldWeight(a.field) - fieldWeight(b.field));
}

export function detectMidasMentions(contact: LushaContact, keywords: string[]): MidasMentionDetection {
  const fields = flattenLushaProfileFields(contact);
  const matchedKeywords = new Set<string>();
  const evidenceFields = new Set<string>();
  const evidenceSnippets: string[] = [];

  for (const field of fields) {
    for (const keyword of keywords) {
      const pattern = keywordPattern(keyword);
      if (!pattern.test(field.text)) continue;

      matchedKeywords.add(keyword);
      evidenceFields.add(field.field || "profile");

      if (evidenceSnippets.length < 4) {
        evidenceSnippets.push(snippet(field.text, pattern));
      }
    }
  }

  const matched = Array.from(matchedKeywords);
  const evidence = Array.from(evidenceFields);

  return {
    hasMidasMention: matched.length > 0,
    matchedKeywords: matched,
    evidenceSnippets,
    evidenceFields: evidence,
    confidence: matched.length ? confidenceForMatch(evidence, matched) : "low"
  };
}

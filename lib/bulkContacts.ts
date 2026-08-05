import type { BulkContactCandidate } from "@/lib/types";

/**
 * Normalises the different result shapes the app produces (job-change records,
 * decision-maker records, and saved runs of either) into the single contact row
 * the bulk email/phone tab works with.
 */
function toCandidate(record: unknown, sourceLabel: string, index: number): BulkContactCandidate | null {
  if (!record || typeof record !== "object") return null;

  const value = record as Record<string, unknown>;
  const personName = typeof value.personName === "string" ? value.personName.trim() : "";

  if (!personName) return null;

  const text = (key: string) => (typeof value[key] === "string" ? (value[key] as string).trim() : "");
  const isProfileRecord = "currentCompany" in value || "decisionMakerScore" in value;

  return {
    id: text("id") || `${sourceLabel}-${index}`,
    lushaContactId: text("lushaContactId") || undefined,
    personName,
    company: isProfileRecord ? text("currentCompany") : text("newCompany") || text("previousCompany"),
    companyDomain: (isProfileRecord ? text("currentCompanyDomain") : text("newCompanyDomain")) || undefined,
    title: isProfileRecord ? text("currentTitle") : text("newTitle") || text("previousTitle"),
    location: text("location") || undefined,
    linkedinUrl: text("linkedinUrl") || undefined,
    sourceLabel
  };
}

export function toBulkCandidates(records: unknown[], sourceLabel: string): BulkContactCandidate[] {
  const candidates = records
    .map((record, index) => toCandidate(record, sourceLabel, index))
    .filter((candidate): candidate is BulkContactCandidate => Boolean(candidate));

  // The same person can appear in more than one result set; the Lusha contact ID
  // is what a reveal is billed against, so it is what de-duplicates the list.
  const seenContactIds = new Set<string>();

  return candidates.filter((candidate) => {
    if (!candidate.lushaContactId) return true;
    if (seenContactIds.has(candidate.lushaContactId)) return false;
    seenContactIds.add(candidate.lushaContactId);
    return true;
  });
}

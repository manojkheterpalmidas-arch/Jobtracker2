import type { DecisionMakerFit, LushaContact, ProfileMidasMentionResult } from "@/lib/types";

function titleOf(contact: LushaContact) {
  if (typeof contact.jobTitle === "string") return contact.jobTitle;
  return contact.jobTitle?.title || contact.title || "Unknown title";
}

function nameOf(contact: LushaContact) {
  return contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown contact";
}

function locationOf(contact: LushaContact) {
  return [contact.location?.city, contact.location?.state, contact.location?.country].filter(Boolean).join(", ");
}

function currentCompany(contact: LushaContact) {
  return contact.company?.name || "Unknown company";
}

function uniqueSignals(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function senioritySignals(title: string, explicitSeniority?: string) {
  const combined = `${title} ${explicitSeniority || ""}`;
  const signals: string[] = [];

  if (/\b(chief|ceo|cto|coo|founder|owner|partner|managing director)\b/i.test(combined)) signals.push("Executive / owner");
  if (/\b(director|technical director|head)\b/i.test(combined)) signals.push("Director / head");
  if (/\b(associate director|associate)\b/i.test(combined)) signals.push("Associate");
  if (/\b(principal|lead|team leader|manager)\b/i.test(combined)) signals.push("Principal / lead");
  if (/\b(senior)\b/i.test(combined)) signals.push("Senior");

  return uniqueSignals(signals);
}

function roleSignals(title: string) {
  const signals: string[] = [];

  if (/\b(bridge|bridges)\b/i.test(title)) signals.push("Bridge");
  if (/\b(structural|structures|civil structures)\b/i.test(title)) signals.push("Structural / civil structures");
  if (/\b(geotechnical|ground engineering|tunnel|tunnelling)\b/i.test(title)) signals.push("Geotechnical / tunnel");
  if (/\b(rail|highways|transport|infrastructure)\b/i.test(title)) signals.push("Infrastructure");
  if (/\b(engineer|engineering|technical)\b/i.test(title)) signals.push("Engineering");

  return uniqueSignals(signals);
}

export function decisionMakerScore(contact: LushaContact) {
  const title = titleOf(contact);
  const explicitSeniority = typeof contact.jobTitle === "object" ? contact.jobTitle?.seniority : undefined;
  let score = 0;

  if (/\b(chief|ceo|cto|coo|founder|owner|partner|managing director)\b/i.test(title)) score += 28;
  if (/\b(technical director|director|head)\b/i.test(title)) score += 24;
  if (/\b(associate director|associate)\b/i.test(title)) score += 20;
  if (/\b(principal|lead|team leader|manager)\b/i.test(title)) score += 18;
  if (/\b(senior)\b/i.test(title)) score += 10;
  if (/\b(bridge|bridges|structural|structures|civil structures|geotechnical|tunnel|rail|highways|infrastructure|civil)\b/i.test(title)) score += 10;
  if (/\b(engineer|engineering|technical)\b/i.test(title)) score += 6;
  if (explicitSeniority && /\b(owner|director|head|vp|principal|senior)\b/i.test(explicitSeniority)) score += 6;
  if (/\b(graduate|junior|assistant|trainee|intern|recruiter|hr|marketing|finance)\b/i.test(title)) score -= 20;

  return Math.max(0, score);
}

export function classifyDecisionMaker(score: number): DecisionMakerFit {
  if (score >= 36) return "high";
  if (score >= 22) return "medium";
  return "low";
}

export function decisionMakerAction(fit: DecisionMakerFit) {
  if (fit === "high") return "Prioritize for manual review and warm outreach.";
  if (fit === "medium") return "Review profile manually before outreach.";
  return "Monitor only.";
}

export function decisionMakerMessage(name: string, company: string) {
  return `Hi ${name}, I noticed your role at ${company} and thought it would be good to connect. I work with engineering teams across civil, structural, bridge and geotechnical workflows, so happy to stay in touch.`;
}

export function buildProfileMidasMentionResult(
  contact: LushaContact,
  checkedAt: string
): ProfileMidasMentionResult {
  const score = decisionMakerScore(contact);
  const championFit = classifyDecisionMaker(score);
  const title = titleOf(contact);
  const personName = nameOf(contact);
  const company = currentCompany(contact);

  return {
    id: contact.id || contact.linkedinUrl || `${personName}-${company}-${title}`,
    lushaContactId: contact.id,
    personName,
    currentCompany: company,
    currentCompanyDomain: contact.company?.domain,
    currentTitle: title,
    location: locationOf(contact),
    linkedinUrl: contact.socialLinks?.linkedin || contact.linkedinUrl,
    decisionMakerScore: score,
    championFit,
    senioritySignals: senioritySignals(title, typeof contact.jobTitle === "object" ? contact.jobTitle?.seniority : undefined),
    roleSignals: roleSignals(title),
    suggestedAction: decisionMakerAction(championFit),
    suggestedMessage: decisionMakerMessage(personName, company),
    checkedAt,
    source: "Lusha"
  };
}

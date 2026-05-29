import { isSpecificMidasProduct } from "@/lib/midasKeywords";
import type { LushaContact, MidasMentionDetection, ProfileMidasMentionResult } from "@/lib/types";

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

function evidenceText(detection: MidasMentionDetection) {
  return detection.evidenceFields.join(" ").toLowerCase();
}

function titleScore(title: string) {
  let score = 0;
  if (/\b(bridge|bridges|structural|structures|geotechnical|tunnel|rail|highways|civil|engineer|engineering)\b/i.test(title)) {
    score += 5;
  }
  if (/\b(senior|principal|associate|director|technical director|head|lead)\b/i.test(title)) {
    score += 5;
  }
  return score;
}

export function midasMentionScore(contact: LushaContact, detection: MidasMentionDetection) {
  if (!detection.hasMidasMention) return 0;

  const evidence = evidenceText(detection);
  let score = 0;

  if (detection.matchedKeywords.some(isSpecificMidasProduct)) score += 30;
  if (/skills|linkedinskills/.test(evidence)) score += 25;
  if (/certifications|courses/.test(evidence)) score += 25;
  if (/experience|experiences/.test(evidence)) score += 20;
  if (/headline|summary|description/.test(evidence)) score += 15;
  if (detection.matchedKeywords.length > 1) score += 10;
  score += titleScore(titleOf(contact));

  return score;
}

export function classifyMidasMentionScore(score: number): MidasMentionDetection["confidence"] {
  if (score >= 35) return "high";
  if (score >= 20) return "medium";
  return "low";
}

export function profileMentionAction(confidence: MidasMentionDetection["confidence"]) {
  if (confidence === "high") return "Prioritize for warm outreach. Profile directly mentions MIDAS.";
  if (confidence === "medium") return "Review profile manually before outreach.";
  return "Monitor only.";
}

export function profileMentionMessage(name: string) {
  return `Hi ${name}, I noticed MIDAS mentioned on your profile and thought it would be good to connect. I work with engineering teams using MIDAS across civil, structural and geotechnical workflows, so happy to stay in touch.`;
}

export function buildProfileMidasMentionResult(
  contact: LushaContact,
  detection: MidasMentionDetection,
  checkedAt: string,
  source: ProfileMidasMentionResult["source"] = "Lusha"
): ProfileMidasMentionResult {
  const score = midasMentionScore(contact, detection);
  const confidence = detection.hasMidasMention
    ? classifyMidasMentionScore(score)
    : "low";
  const personName = nameOf(contact);

  return {
    id: contact.id || contact.linkedinUrl || `${personName}-${currentCompany(contact)}-${titleOf(contact)}`,
    lushaContactId: contact.id,
    personName,
    currentCompany: currentCompany(contact),
    currentCompanyDomain: contact.company?.domain,
    currentTitle: titleOf(contact),
    location: locationOf(contact),
    linkedinUrl: contact.socialLinks?.linkedin || contact.linkedinUrl,
    ...detection,
    confidence,
    midasMentionScore: score,
    suggestedAction: profileMentionAction(confidence),
    suggestedMessage: detection.hasMidasMention ? profileMentionMessage(personName) : "No direct MIDAS mention found in available profile fields.",
    checkedAt,
    source
  };
}

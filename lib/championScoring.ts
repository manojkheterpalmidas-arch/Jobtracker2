import { daysSince } from "@/lib/date";
import type {
  ChampionContactJobChange,
  ChampionPotential,
  ContactJobChange,
  MidasCompanyMatch,
  MidasRelationshipStatus
} from "@/lib/types";

function titleText(record: ContactJobChange) {
  return `${record.previousTitle} ${record.newTitle}`.toLowerCase();
}

function matchScore(confidence: MidasCompanyMatch["confidence"]) {
  if (confidence === "exact_domain") return 20;
  if (confidence === "exact_name") return 15;
  if (confidence === "fuzzy_name") return 10;
  return 0;
}

function relationshipScore(status?: MidasRelationshipStatus) {
  if (status === "Client") return 10;
  if (status === "Former Client") return 7;
  if (status === "Partner") return 6;
  if (status === "Prospect") return 3;
  return 0;
}

function titleScore(record: ContactJobChange) {
  const text = titleText(record);
  let score = 0;

  if (/\b(bridge|bridges|structural|structures|geotechnical|tunnel|rail|highways|civil)\b/i.test(text)) {
    score += 5;
  }

  if (/\b(senior|principal|associate|director|technical director|head|lead)\b/i.test(text)) {
    score += 5;
  }

  return score;
}

function recencyScore(signalDate: string) {
  const days = daysSince(signalDate);

  if (days <= 90) return 4;
  if (days <= 180) return 2;
  return 0;
}

export function classifyChampionPotential(score: number): ChampionPotential {
  if (score >= 35) return "High";
  if (score >= 22) return "Medium";
  if (score >= 10) return "Low";
  return "Unknown";
}

export function championAction(potential: ChampionPotential) {
  if (potential === "High") {
    return "Soft reconnect / introduction. Prioritize for manual LinkedIn review.";
  }

  if (potential === "Medium") {
    return "Review profile manually before outreach.";
  }

  return "Monitor only.";
}

export function championMessage(record: ContactJobChange) {
  return `Hi ${record.personName}, congratulations on your new role at ${record.newCompany}. I noticed you previously worked with ${record.previousCompany}, where we have had MIDAS-related engagement. It would be good to stay connected, especially if bridge, structural, geotechnical, or civil engineering workflows come up in your new team.`;
}

export function scoreChampion(record: ContactJobChange, match: MidasCompanyMatch): ChampionContactJobChange {
  const relationship = match.account?.relationshipStatus;
  const score =
    matchScore(match.confidence) +
    relationshipScore(relationship) +
    titleScore(record) +
    recencyScore(record.signalDate);
  const championPotential = classifyChampionPotential(score);
  const matchedCompany = match.account?.companyName;
  const country = match.account?.country;
  const status = relationship?.toLowerCase() ?? "unknown account";
  const championReason = match.matched
    ? `${championPotential} potential: joined target company from ${matchedCompany}${country ? ` ${country}` : ""}, which is listed as a MIDAS ${status}.`
    : "Low confidence: previous company is not in MIDAS account database.";

  return {
    ...record,
    previousCompanyCountryFromDatabase: country,
    midasRelationshipStatus: relationship,
    midasAccountMatched: match.matched,
    midasMatchedCompanyName: matchedCompany,
    midasMatchConfidence: match.confidence,
    championPotential,
    championReason,
    championLikelihoodScore: score,
    suggestedSalesAction: championAction(championPotential),
    suggestedMessage: match.matched ? championMessage(record) : record.suggestedMessage
  };
}

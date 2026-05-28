import { daysSince } from "@/lib/date";
import type { ContactJobChange, PriorityLevel } from "@/lib/types";

const irrelevantTitlePattern =
  /\b(recruiter|recruitment|talent acquisition|hr|human resources|finance|financial|marketing|sales|account executive|business development|quantity surveyor|qs|architect|mep|mechanical|electrical|plumbing)\b/i;

const juniorPattern = /\b(graduate|junior|assistant|intern|trainee)\b/i;

export function excludeIrrelevantTitles(title = "") {
  return irrelevantTitlePattern.test(title);
}

function titleHas(title: string, pattern: RegExp) {
  return pattern.test(title);
}

export function scoreContactJobChange(record: Pick<ContactJobChange, "newTitle" | "previousTitle" | "newCompany" | "signalDate">) {
  const combinedTitle = `${record.newTitle} ${record.previousTitle}`;
  let score = 0;

  if (titleHas(combinedTitle, /\bbridge|bridges\b/i)) score += 5;
  if (titleHas(combinedTitle, /\bstructural|structures\b/i)) score += 5;
  if (titleHas(combinedTitle, /\bcivil structural\b/i)) score += 4;
  if (titleHas(combinedTitle, /\bassessment\b/i)) score += 4;
  if (titleHas(combinedTitle, /\brail|highways|infrastructure\b/i)) score += 3;
  if (titleHas(combinedTitle, /\brail (and|&) civils|major bridges|rail civil\b/i)) score += 4;
  if (titleHas(combinedTitle, /\bprincipal\b/i)) score += 3;
  if (titleHas(combinedTitle, /\bassociate\b/i)) score += 3;
  if (titleHas(combinedTitle, /\btechnical director|director|head\b/i)) score += 4;
  if (titleHas(combinedTitle, /\btechnical manager|engineering manager|design manager|technical lead|engineering lead|design lead|team leader|structures lead|bridge lead\b/i)) score += 3;
  if (titleHas(combinedTitle, /\bsenior\b/i)) score += 2;
  if (titleHas(record.newCompany, /\b(engineering|consult|infrastructure|design|partners|group|arup|ramboll|cowi|sweco|atkins|aecom)\b/i)) score += 2;

  const ageDays = daysSince(record.signalDate);
  if (ageDays <= 30) score += 3;
  else if (ageDays <= 90) score += 2;

  if (juniorPattern.test(combinedTitle)) score -= 2;
  if (excludeIrrelevantTitles(combinedTitle)) score -= 10;

  return score;
}

export function classifyPriority(score: number, title: string, signalDate: string): PriorityLevel {
  const recent = daysSince(signalDate) <= 90;
  const seniorOrCore = /\b(principal|associate|director|technical director|head|bridge|bridges|structures|structural)\b/i.test(title);

  if (score >= 10 || (recent && seniorOrCore)) {
    return "High";
  }

  if (score >= 5) {
    return "Medium";
  }

  return "Monitor";
}

export function suggestedSalesAction(priority: PriorityLevel, title: string) {
  if (priority === "High") {
    return "High priority reconnect";
  }

  if (priority === "Medium" || /\bengineer|consultant|technical\b/i.test(title)) {
    return "Warm relationship follow-up";
  }

  return "Monitor only";
}

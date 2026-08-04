import { normalizeDomain } from "@/lib/domain";
import type { MidasAccount, MidasCompanyMatch } from "@/lib/types";

const COMPANY_SUFFIXES = [
  "zt gmbh",
  "consulting engineers",
  "consulting",
  "engineers",
  "engineering",
  "limited",
  "ltd",
  "gmbh",
  "kft",
  "llc",
  "inc",
  "plc",
  "group",
  "the"
];

export function normalizeCompanyNameForMatch(value?: string) {
  let normalized = (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const suffix of COMPANY_SUFFIXES) {
    normalized = normalized.replace(new RegExp(`\\b${suffix}\\b`, "g"), " ");
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 0; i < a.length; i += 1) {
    let current = i + 1;
    let diagonal = i;

    for (let j = 0; j < b.length; j += 1) {
      const insert = current + 1;
      const deleteCost = previous[j + 1] + 1;
      const replace = diagonal + (a[i] === b[j] ? 0 : 1);
      diagonal = previous[j + 1];
      previous[j + 1] = Math.min(insert, deleteCost, replace);
      current = previous[j + 1];
    }
  }

  return previous[b.length];
}

function fuzzyCompanyMatch(candidate: string, account: string) {
  if (!candidate || !account) return false;
  if (candidate === account) return true;
  if (candidate.includes(account) || account.includes(candidate)) return true;

  const candidateTokens = new Set(candidate.split(" ").filter(Boolean));
  const accountTokens = account.split(" ").filter(Boolean);
  const shared = accountTokens.filter((token) => candidateTokens.has(token)).length;
  const tokenScore = shared / Math.max(accountTokens.length, 1);
  const distance = levenshtein(candidate, account);
  const similarity = 1 - distance / Math.max(candidate.length, account.length, 1);

  return tokenScore >= 0.67 || similarity >= 0.82;
}

export function findMidasCompanyMatch(
  previousCompany: string | undefined,
  previousDomain: string | undefined,
  accounts: MidasAccount[]
): MidasCompanyMatch {
  const domain = normalizeDomain(previousDomain || "");
  const normalizedPreviousCompany = normalizeCompanyNameForMatch(previousCompany);

  if (domain) {
    const account = accounts.find((item) => normalizeDomain(item.companyDomain || "") === domain);
    if (account) {
      return {
        matched: true,
        account,
        confidence: "exact_domain",
        normalizedPreviousCompany
      };
    }
  }

  const exactName = accounts.find(
    (item) => normalizeCompanyNameForMatch(item.companyName) === normalizedPreviousCompany
  );

  if (exactName) {
    return {
      matched: true,
      account: exactName,
      confidence: "exact_name",
      normalizedPreviousCompany
    };
  }

  const fuzzyName = accounts.find((item) =>
    fuzzyCompanyMatch(normalizedPreviousCompany, normalizeCompanyNameForMatch(item.companyName))
  );

  if (fuzzyName) {
    return {
      matched: true,
      account: fuzzyName,
      confidence: "fuzzy_name",
      normalizedPreviousCompany
    };
  }

  return {
    matched: false,
    confidence: "none",
    normalizedPreviousCompany
  };
}

export function accountDuplicateKey(account: { companyName: string; companyDomain?: string; country: string }) {
  const country = account.country.trim().toLowerCase();
  const domain = normalizeDomain(account.companyDomain || "");

  if (domain) {
    return `domain:${domain}|${country}`;
  }

  return `name:${normalizeCompanyNameForMatch(account.companyName)}|${country}`;
}

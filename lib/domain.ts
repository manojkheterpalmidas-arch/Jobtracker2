export function removeProtocol(input: string) {
  return input.trim().replace(/^https?:\/\//i, "");
}

export function removeWww(input: string) {
  return input.replace(/^www\./i, "");
}

export function removeTrailingSlash(input: string) {
  return input.replace(/\/+$/g, "");
}

export function normalizeDomain(input?: string | null) {
  if (!input) {
    return "";
  }

  const noProtocol = removeProtocol(input);
  const noWww = removeWww(noProtocol);
  const withoutPath = noWww.split("/")[0] ?? "";

  return removeTrailingSlash(withoutPath).trim().toLowerCase();
}

export function parseDomains(input?: string | string[] | null) {
  const values = Array.isArray(input) ? input : (input ?? "").split(/[\n,;]+/);

  return Array.from(
    new Set(
      values
        .flatMap((value) => value.split(/[\n,;]+/))
        .map(normalizeDomain)
        .filter(Boolean)
    )
  );
}

export function isValidDomain(domain?: string | null) {
  if (!domain) {
    return false;
  }

  const normalized = normalizeDomain(domain);

  if (normalized.length > 253 || normalized.includes(" ") || normalized.includes("@")) {
    return false;
  }

  const labels = normalized.split(".");

  if (labels.length < 2) {
    return false;
  }

  return labels.every((label) => {
    return (
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    );
  });
}

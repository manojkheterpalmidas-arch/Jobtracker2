export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getStartDate(durationDays: number, now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - durationDays);
  return toIsoDate(start);
}

export function isOnOrAfter(dateValue: string | undefined, startDate: string) {
  if (!dateValue) {
    return false;
  }

  return dateValue.slice(0, 10) >= startDate;
}

export function daysSince(dateValue: string, now = new Date()) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

export function getLocalDateKey(input: {
  timestamp: string;
  userTimeZone: string;
}): string | null {
  const date = new Date(input.timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en", {
      day: "2-digit",
      month: "2-digit",
      timeZone: input.userTimeZone,
      year: "numeric",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year === undefined || month === undefined || day === undefined) {
      return null;
    }

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

export function formatLocalMonthDay(input: {
  timestamp: string;
  userTimeZone: string;
}): string | null {
  const date = new Date(input.timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      timeZone: input.userTimeZone,
    }).format(date);
  } catch {
    return null;
  }
}

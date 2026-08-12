const PARIS_TIME_ZONE = "Europe/Paris";

export function parisDayBounds(date: string): { start: Date; end: Date } {
  return {
    start: parisDateTime(date, "00:00:00"),
    end: parisDateTime(addCalendarDay(date), "00:00:00"),
  };
}

export function parisTimeOnInstantDay(instant: Date, time: string): Date {
  const date = new Intl.DateTimeFormat("fr-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return parisDateTime(date, time);
}

function parisDateTime(date: string, time: string): Date {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = time.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = utcGuess;
  // Deux passages couvrent le changement éventuel d'offset lors des transitions DST.
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = timeZoneOffsetAt(new Date(candidate));
    candidate = utcGuess - offset;
  }
  return new Date(candidate);
}

function timeZoneOffsetAt(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  const representedAsUtc = Date.UTC(
    Number(values.get("year")),
    Number(values.get("month")) - 1,
    Number(values.get("day")),
    Number(values.get("hour")),
    Number(values.get("minute")),
    Number(values.get("second")),
  );
  return representedAsUtc - instant.getTime();
}

function addCalendarDay(date: string): string {
  const cursor = new Date(`${date}T12:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  return cursor.toISOString().slice(0, 10);
}

import { NetWorthTimelineGranularity } from "../interfaces/investment-transaction.interface";
import { shiftToInstant } from "./timezone";

// UTC-anchored (Date.UTC / getUTC*) internally, since dateFrom/dateTo represent the *client's
// local* calendar fields expressed via UTC-field arithmetic — matching how buildDateFilter()
// interprets "YYYY-MM-DD" query params the same way. Bucket start/end are shifted by
// tzOffsetMinutes right before being returned so they become real UTC instants, comparable
// against `date` (a true UTC instant) — see src/utils/timezone.ts. Unlike reportBuckets.ts's
// buildReportBuckets (which auto-picks granularity from the period span), the net-worth
// timeline lets the caller choose day/month/year explicitly, so this only needs to lay
// out buckets for whichever granularity was requested.

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface InvestmentBucket {
  label: string;
  start: Date;
  end: Date;
}

function parseIsoDateUtc(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUtc(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * MS_PER_DAY);
}

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

// Buckets never extend past the requested `dateTo` — matters for the trailing,
// still-in-progress bucket (current month/year) so its label doesn't imply data
// that hasn't happened yet.
function clampDate(date: Date, max: Date): Date {
  return date.getTime() > max.getTime() ? max : date;
}

function shiftBuckets(buckets: InvestmentBucket[], tzOffsetMinutes: number): InvestmentBucket[] {
  return buckets.map((bucket) => ({
    label: bucket.label,
    start: shiftToInstant(bucket.start, tzOffsetMinutes),
    end: shiftToInstant(bucket.end, tzOffsetMinutes),
  }));
}

export function buildInvestmentBuckets(
  dateFrom: string,
  dateTo: string,
  granularity: NetWorthTimelineGranularity,
  locale: string,
  tzOffsetMinutes = 0,
): InvestmentBucket[] {
  const from = parseIsoDateUtc(dateFrom);
  const to = endOfDayUtc(parseIsoDateUtc(dateTo));

  if (granularity === "day") {
    const buckets: InvestmentBucket[] = [];
    let cursor = from;
    while (cursor.getTime() <= to.getTime()) {
      buckets.push({
        label: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(
          cursor,
        ),
        start: startOfDayUtc(cursor),
        end: clampDate(endOfDayUtc(cursor), to),
      });
      cursor = addDaysUtc(cursor, 1);
    }
    return shiftBuckets(buckets, tzOffsetMinutes);
  }

  if (granularity === "year") {
    const buckets: InvestmentBucket[] = [];
    let year = from.getUTCFullYear();
    const toYear = to.getUTCFullYear();
    while (year <= toYear) {
      const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      buckets.push({
        label: String(year),
        start: new Date(Date.UTC(year, 0, 1)),
        end: clampDate(yearEnd, to),
      });
      year += 1;
    }
    return shiftBuckets(buckets, tzOffsetMinutes);
  }

  // month
  const buckets: InvestmentBucket[] = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor.getTime() <= lastMonth.getTime()) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    buckets.push({
      label: new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(
        cursor,
      ),
      start: new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)),
      end: clampDate(monthEnd, to),
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return shiftBuckets(buckets, tzOffsetMinutes);
}

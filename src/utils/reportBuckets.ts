// Ported from the frontend's src/utils/report-period.ts (buildReportBuckets) so the cash-flow
// endpoint buckets identically to how the client used to bucket client-side. Internally anchored
// in UTC (Date.UTC / getUTC*) since dateFrom/dateTo/labels represent the *client's local*
// calendar fields expressed via UTC-field arithmetic — matching how buildDateFilter() interprets
// "YYYY-MM-DD" query params the same way. Bucket start/end are shifted by tzOffsetMinutes right
// before being returned so they become real UTC instants, comparable against `date` (a true UTC
// instant) — see src/utils/timezone.ts.

import { instantToLocalFieldsDate, shiftToInstant } from "./timezone";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const HOUR_BLOCK_STARTS = [0, 4, 8, 12, 16, 20];

export interface ReportBucket {
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

function daysBetweenInclusiveUtc(a: Date, b: Date): number {
  return Math.round((startOfDayUtc(b).getTime() - startOfDayUtc(a).getTime()) / MS_PER_DAY) + 1;
}

function clampDate(date: Date, max: Date): Date {
  return date.getTime() > max.getTime() ? max : date;
}

function shiftBuckets(buckets: ReportBucket[], tzOffsetMinutes: number): ReportBucket[] {
  return buckets.map((bucket) => ({
    label: bucket.label,
    start: shiftToInstant(bucket.start, tzOffsetMinutes),
    end: shiftToInstant(bucket.end, tzOffsetMinutes),
  }));
}

/** Chooses bucket granularity (hourly/daily/weekly/monthly) from the period span. */
export function buildReportBuckets(
  dateFrom: string,
  dateTo: string,
  locale: string,
  tzOffsetMinutes = 0,
): ReportBucket[] {
  const from = parseIsoDateUtc(dateFrom);
  const to = parseIsoDateUtc(dateTo);
  const spanDays = daysBetweenInclusiveUtc(from, to);

  if (spanDays <= 1) {
    return shiftBuckets(
      HOUR_BLOCK_STARTS.map((hour) => ({
        label: `${String(hour).padStart(2, "0")}:00`,
        start: new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hour, 0, 0, 0)),
        end: new Date(
          Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hour + 3, 59, 59, 999),
        ),
      })),
      tzOffsetMinutes,
    );
  }

  if (spanDays <= 14) {
    return shiftBuckets(
      Array.from({ length: spanDays }, (_, index) => {
        const day = addDaysUtc(from, index);
        return {
          label: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(day),
          start: startOfDayUtc(day),
          end: endOfDayUtc(day),
        };
      }),
      tzOffsetMinutes,
    );
  }

  if (spanDays <= 62) {
    const buckets: ReportBucket[] = [];
    let cursor = from;
    let weekIndex = 1;
    while (cursor.getTime() <= to.getTime()) {
      const weekEnd = clampDate(addDaysUtc(cursor, 6), to);
      buckets.push({
        label: `W${weekIndex}`,
        start: startOfDayUtc(cursor),
        end: endOfDayUtc(weekEnd),
      });
      cursor = addDaysUtc(weekEnd, 1);
      weekIndex += 1;
    }
    return shiftBuckets(buckets, tzOffsetMinutes);
  }

  const buckets: ReportBucket[] = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor.getTime() <= lastMonth.getTime()) {
    buckets.push({
      label: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(cursor),
      start: new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return shiftBuckets(buckets, tzOffsetMinutes);
}

export function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonthsUtc(date: Date, amount: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

/** `before`/`after` months around `center`, inclusive, oldest first. */
export function generateMonthRangeUtc(center: Date, before: number, after: number): Date[] {
  const start = startOfMonthUtc(center);
  const months: Date[] = [];
  for (let i = -before; i <= after; i++) months.push(addMonthsUtc(start, i));
  return months;
}

export function formatMonthShortLabel(date: Date, locale: string, tzOffsetMinutes = 0): string {
  const label = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date);
  const currentYear = instantToLocalFieldsDate(new Date(), tzOffsetMinutes).getUTCFullYear();
  return date.getUTCFullYear() === currentYear ? label : `${label} '${String(date.getUTCFullYear()).slice(-2)}`;
}

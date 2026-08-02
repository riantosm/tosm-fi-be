// Every date-scoped query ("YYYY-MM" month, "YYYY-MM-DD" dateFrom/dateTo, day/month/year
// buckets, monthly $group aggregations) needs to be interpreted against the *client's* local
// calendar, not the server's UTC one — otherwise a transaction entered in the first few hours
// of a local calendar day/month gets misfiled under the previous UTC day/month. The frontend
// sends its own `Date.prototype.getTimezoneOffset()` value as `tzOffsetMinutes` on every
// date-scoped request (see tosm-fi-fe's http-client.ts request interceptor); every service that
// builds a date filter/bucket/aggregation from such a request threads it through these helpers.
//
// `tzOffsetMinutes` follows JS's own `getTimezoneOffset()` sign convention: the number of
// minutes to ADD to a local wall-clock instant to get the UTC instant (e.g. WIB/UTC+7 is -420).

/** Parses a raw (possibly missing/non-numeric) query value into a safe offset, defaulting to UTC (0). */
export function parseTzOffsetMinutes(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Converts "local wall-clock fields expressed via UTC-field arithmetic" (e.g. `Date.UTC(y, m, d)`,
 * which treats those numbers as if they were UTC) into the real UTC instant they represent.
 */
export function localFieldsMsToInstantMs(localFieldsMs: number, tzOffsetMinutes: number): number {
  return localFieldsMs + tzOffsetMinutes * 60000;
}

/** Same as `localFieldsMsToInstantMs`, returning a Date. */
export function shiftToInstant(localFieldsDate: Date, tzOffsetMinutes: number): Date {
  return new Date(localFieldsMsToInstantMs(localFieldsDate.getTime(), tzOffsetMinutes));
}

/**
 * The inverse: given a real UTC instant, returns a Date whose UTC-* getters (getUTCFullYear,
 * getUTCMonth, getUTCHours, ...) read back the client's local wall-clock fields — used to group
 * or label by local calendar day/month/year via the same `timeZone: "UTC"` Intl formatting this
 * codebase already relies on for UTC-anchored bucket labels.
 */
export function instantToLocalFieldsDate(instant: Date, tzOffsetMinutes: number): Date {
  return new Date(instant.getTime() - tzOffsetMinutes * 60000);
}

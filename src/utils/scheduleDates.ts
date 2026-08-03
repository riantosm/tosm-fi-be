import { ScheduleFrequency } from "../interfaces/schedule.interface";

export interface ScheduleRecurrenceRule {
  frequency: ScheduleFrequency;
  weekdays: number[];
  dayOfMonth: number | null;
  month: number | null;
}

const MS_PER_DAY = 86400000;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDaysUtc(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * MS_PER_DAY);
}

function daysInMonthUtc(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

// Clamps e.g. dayOfMonth=31 in February down to 28/29 instead of overflowing
// into March, and handles leap years naturally via daysInMonthUtc.
function clampDayOfMonth(year: number, month0: number, day: number): number {
  return Math.min(day, daysInMonthUtc(year, month0));
}

function dateForMonth(year: number, month0: number, dayOfMonth: number): Date {
  return new Date(Date.UTC(year, month0, clampDayOfMonth(year, month0, dayOfMonth)));
}

// The first valid due date on/after startDate for the given rule.
export function getFirstDueDate(startDate: Date, rule: ScheduleRecurrenceRule): Date {
  const start = startOfUtcDay(startDate);

  switch (rule.frequency) {
    case "daily":
      return start;
    case "weekly": {
      for (let offset = 0; offset < 7; offset++) {
        const day = addDaysUtc(start, offset);
        if (rule.weekdays.includes(day.getUTCDay())) return day;
      }
      throw new Error("weekdays tidak valid");
    }
    case "monthly": {
      const candidate = dateForMonth(start.getUTCFullYear(), start.getUTCMonth(), rule.dayOfMonth!);
      return candidate.getTime() >= start.getTime()
        ? candidate
        : dateForMonth(start.getUTCFullYear(), start.getUTCMonth() + 1, rule.dayOfMonth!);
    }
    case "yearly": {
      const month0 = rule.month! - 1;
      const candidate = dateForMonth(start.getUTCFullYear(), month0, rule.dayOfMonth!);
      return candidate.getTime() >= start.getTime()
        ? candidate
        : dateForMonth(start.getUTCFullYear() + 1, month0, rule.dayOfMonth!);
    }
    default:
      throw new Error("frequency tidak valid");
  }
}

// The next due date strictly after `current` for the given rule.
export function getNextDueDate(current: Date, rule: ScheduleRecurrenceRule): Date {
  switch (rule.frequency) {
    case "daily":
      return addDaysUtc(current, 1);
    case "weekly": {
      for (let offset = 1; offset <= 7; offset++) {
        const day = addDaysUtc(current, offset);
        if (rule.weekdays.includes(day.getUTCDay())) return day;
      }
      throw new Error("weekdays tidak valid");
    }
    case "monthly":
      return dateForMonth(current.getUTCFullYear(), current.getUTCMonth() + 1, rule.dayOfMonth!);
    case "yearly":
      return dateForMonth(current.getUTCFullYear() + 1, rule.month! - 1, rule.dayOfMonth!);
    default:
      throw new Error("frequency tidak valid");
  }
}

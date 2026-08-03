export type ScheduleType = "income" | "expense";
export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type ScheduleOccurrenceStatus = "pending" | "paid" | "cancelled";

export interface ISchedule {
  idUser: string;
  title: string;
  notes: string;
  type: ScheduleType;
  amount: number;
  idWallet: string;
  idCategory: string;
  idSubCategory: string | null;
  frequency: ScheduleFrequency;
  // 0=Minggu..6=Sabtu — only meaningful when frequency === "weekly".
  weekdays: number[];
  // Derived server-side from startDate — not client-supplied. Set for
  // monthly/yearly, null for daily/weekly.
  dayOfMonth: number | null;
  // Derived server-side from startDate — only set for yearly.
  month: number | null;
  startDate: Date;
  isActive: boolean;
  // High-water mark for the lazy catch-up generator — the last due date
  // already turned into a ScheduleOccurrence, or null if never generated.
  lastGeneratedDueDate: Date | null;
}

export interface IScheduleOccurrence {
  idUser: string;
  idSchedule: string;
  dueDate: Date;
  status: ScheduleOccurrenceStatus;
  // Snapshot of the rule at generation time so editing the rule later never
  // retroactively changes an already-generated pending occurrence.
  type: ScheduleType;
  title: string;
  amount: number;
  idWallet: string;
  idCategory: string;
  idSubCategory: string | null;
  idTransaction: string | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
}

export interface ICreateScheduleInput {
  title: string;
  notes?: string;
  type: ScheduleType;
  amount: number;
  idWallet: string;
  idCategory: string;
  idSubCategory?: string | null;
  frequency: ScheduleFrequency;
  weekdays?: number[];
  startDate: string;
}

export type IUpdateScheduleInput = ICreateScheduleInput;

export interface ISafeSchedule {
  idSchedule: string;
  title: string;
  notes: string;
  type: ScheduleType;
  amount: number;
  idWallet: string;
  idCategory: string;
  idSubCategory: string | null;
  frequency: ScheduleFrequency;
  weekdays: number[];
  dayOfMonth: number | null;
  month: number | null;
  startDate: string;
  isActive: boolean;
}

export interface ISafeScheduleOccurrence {
  idOccurrence: string;
  idSchedule: string;
  dueDate: string;
  status: ScheduleOccurrenceStatus;
  type: ScheduleType;
  title: string;
  amount: number;
  idWallet: string;
  idCategory: string;
  idSubCategory: string | null;
  idTransaction: string | null;
}

export interface IPayOccurrenceInput {
  amount?: number;
  date?: string;
  idWallet?: string;
  idCategory?: string;
  idSubCategory?: string | null;
  title?: string;
  notes?: string;
}

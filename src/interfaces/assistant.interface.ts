import { ISafeInvestmentTransaction } from "./investment-transaction.interface";
import { ISafeTransaction } from "./transaction.interface";

/** Every input the app has: the four wallet transaction types + the four investment ledger operations. */
export type AssistantDraftKind =
  | "income"
  | "expense"
  | "transfer"
  | "correction"
  | "investmentIn"
  | "investmentOut"
  | "investmentTransfer"
  | "investmentPl";

export type AssistantIntent = "ask" | "preview" | "save" | "cancel" | "unknown";

export type AssistantLanguage = "id" | "en" | "jp";

/**
 * One proposed transaction, in the exact shape the frontend previews and
 * sends back on the next turn / on commit. Which id fields apply depends on
 * `kind`, same as the Transaction / InvestmentTransaction models:
 * - income/expense: idWallet + idCategory (+ idSubCategory)
 * - transfer: idWalletFrom + idWalletTo
 * - correction: idWallet, balanceBefore → balanceAfter (amount = |delta|)
 * - investmentIn: idWallet + expense idCategory → idInstrument/idInvestmentAccount
 * - investmentOut: idInstrument/idInvestmentAccount → optional idWallet + income idCategory
 * - investmentTransfer: idInstrument/idInvestmentAccount → idInstrumentTo/idInvestmentAccountTo
 * - investmentPl: idInstrument/idInvestmentAccount, balanceBefore → balanceAfter (current value)
 */
export interface IAssistantDraft {
  idDraft: string;
  kind: AssistantDraftKind;
  title: string;
  /** Always positive; the sign comes from `kind` (or balanceBefore → balanceAfter). */
  amount: number;
  /** ISO datetime. */
  date: string;
  notes: string;
  idWallet: string | null;
  idCategory: string | null;
  idSubCategory: string | null;
  idWalletFrom: string | null;
  idWalletTo: string | null;
  idInstrument: string | null;
  idInvestmentAccount: string | null;
  idInstrumentTo: string | null;
  idInvestmentAccountTo: string | null;
  balanceBefore?: number;
  balanceAfter?: number;
  /** Fields the latest revision changed (drives the preview's highlight chips). */
  changed?: string[];
  /** Validation problem; the row is marked and saving is blocked until it's fixed. */
  error?: string;
  /** Fields the user hasn't given yet (e.g. "date"), so the next turn still asks for them. */
  missing?: string[];
}

export interface IAssistantQuickReply {
  label: string;
  /** Text sent when tapped (defaults to label). */
  value?: string;
  dot?: string;
  icon?: "calendar";
}

export interface IAssistantReply {
  intent: AssistantIntent;
  reply: string;
  drafts: IAssistantDraft[];
  quickReplies?: IAssistantQuickReply[];
}

export interface IAssistantHistoryItem {
  role: "user" | "assistant";
  text: string;
}

export interface IAssistantChatInput {
  history: IAssistantHistoryItem[];
  /** Drafts currently pending (asked about or previewed), as last returned. */
  drafts: IAssistantDraft[];
  /** Client's `Date.getTimezoneOffset()` value — see src/utils/timezone.ts. */
  tzOffsetMinutes: number;
  language: AssistantLanguage;
  /** True when those drafts are on screen as a preview awaiting Simpan/Batal. */
  hasPreview: boolean;
}

export interface IAssistantCommitResult {
  transactions: ISafeTransaction[];
  investmentTransactions: ISafeInvestmentTransaction[];
}

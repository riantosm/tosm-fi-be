import { AssistantDraftKind, AssistantLanguage } from "../interfaces/assistant.interface";

// The model never sees Mongo ids: wallets/categories/accounts/pending drafts
// are given short refs (W1, C2.1, A3, D1) that assistant.service.ts maps back.
// Short refs are copied far more reliably than 24-char hex ids, and cost fewer
// tokens.

export const DRAFT_KINDS: AssistantDraftKind[] = [
  "expense",
  "income",
  "transfer",
  "correction",
  "investmentIn",
  "investmentOut",
  "investmentTransfer",
  "investmentPl",
];

export const ASK_FIELDS = [
  "none",
  "date",
  "amount",
  "wallet",
  "walletFrom",
  "walletTo",
  "account",
  "accountTo",
  "category",
  "other",
] as const;
export type AskField = (typeof ASK_FIELDS)[number];

/** A draft as the model reads and writes it. Every field is always present ("" / 0 when n/a). */
export interface ModelDraft {
  ref: string;
  kind: AssistantDraftKind;
  title: string;
  amount: number;
  target: number;
  date: string;
  time: string;
  notes: string;
  wallet: string;
  category: string;
  subCategory: string;
  walletFrom: string;
  walletTo: string;
  account: string;
  accountTo: string;
}

export interface ModelOutput {
  intent: "ask" | "preview" | "save" | "cancel" | "unknown";
  reply: string;
  ask: AskField;
  options: string[];
  drafts: ModelDraft[];
}

const str = { type: "string" };
const num = { type: "number" };

export const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "reply", "ask", "options", "drafts"],
  properties: {
    intent: { type: "string", enum: ["ask", "preview", "save", "cancel", "unknown"] },
    reply: str,
    ask: { type: "string", enum: [...ASK_FIELDS] },
    options: { type: "array", items: str },
    drafts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "ref",
          "kind",
          "title",
          "amount",
          "target",
          "date",
          "time",
          "notes",
          "wallet",
          "category",
          "subCategory",
          "walletFrom",
          "walletTo",
          "account",
          "accountTo",
        ],
        properties: {
          ref: str,
          kind: { type: "string", enum: DRAFT_KINDS },
          title: str,
          amount: num,
          target: num,
          date: str,
          time: str,
          notes: str,
          wallet: str,
          category: str,
          subCategory: str,
          walletFrom: str,
          walletTo: str,
          account: str,
          accountTo: str,
        },
      },
    },
  },
};

export interface PromptInput {
  language: AssistantLanguage;
  /** Local wall-clock "now", expressed through UTC fields (see utils/timezone.ts). */
  nowLocal: Date;
  wallets: { ref: string; name: string; balance: number; isPrimary: boolean }[];
  categories: {
    ref: string;
    name: string;
    type: "income" | "expense";
    subs: { ref: string; name: string }[];
  }[];
  accounts: { ref: string; instrument: string; account: string; currentValue: number }[];
  pending: ModelDraft[];
}

const LANGUAGE_STYLE: Record<AssistantLanguage, string> = {
  id: "casual Indonesian (use \"aku\"/\"kamu\", friendly, like chatting with a friend)",
  en: "casual, friendly English",
  jp: "friendly, polite Japanese",
};

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekday(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(date);
}

function recentDays(nowLocal: Date): string {
  const days: string[] = [];
  for (let back = 1; back <= 7; back++) {
    const day = new Date(nowLocal.getTime() - back * 86_400_000);
    days.push(`${ymd(day)} ${weekday(day)}${back === 1 ? " (yesterday)" : ""}`);
  }
  return days.join(", ");
}

function userData(input: PromptInput): string {
  const lines: string[] = [];
  lines.push("Wallets (ref | name | balance):");
  if (input.wallets.length === 0) lines.push("(none)");
  for (const w of input.wallets) {
    lines.push(`${w.ref} | ${w.name} | ${w.balance}${w.isPrimary ? " | PRIMARY" : ""}`);
  }

  for (const type of ["expense", "income"] as const) {
    lines.push(`${type === "expense" ? "Expense" : "Income"} categories (ref | name | subcategories):`);
    const list = input.categories.filter((c) => c.type === type);
    if (list.length === 0) lines.push("(none)");
    for (const c of list) {
      const subs = c.subs.map((s) => `${s.ref} ${s.name}`).join(", ");
      lines.push(`${c.ref} | ${c.name}${subs ? ` | ${subs}` : ""}`);
    }
  }

  lines.push("Investment accounts (ref | instrument | account | current value):");
  if (input.accounts.length === 0) lines.push("(none)");
  for (const a of input.accounts) {
    lines.push(`${a.ref} | ${a.instrument} | ${a.account} | ${a.currentValue}`);
  }
  return lines.join("\n");
}

export function buildSystemPrompt(input: PromptInput): string {
  const now = input.nowLocal;
  const time = now.toISOString().slice(11, 16);
  const pending = input.pending.length ? JSON.stringify(input.pending) : "none";

  return `You are "Catat Cepat", the quick-entry assistant inside TosmFi, a personal finance app. Your only job: turn the user's casual messages into transaction drafts that match their data, ask for anything missing, and notice when they confirm or cancel.

LANGUAGE: write \`reply\` in ${LANGUAGE_STYLE[input.language]}. One or two short sentences. Never list the drafts or their amounts in \`reply\`; the app shows them as a preview card.

NOW (user's local time): ${weekday(now)} ${ymd(now)} ${time}
Recent days: ${recentDays(now)}

USER DATA. Use only these refs; never invent wallets, categories or accounts.
${userData(input)}

PENDING DRAFTS (already asked about or previewed; keep their ref when you return them): ${pending}

AMOUNTS
- rb / ribu / k = x1.000; jt / juta = x1.000.000; M / miliar = x1.000.000.000.
- Comma is the decimal separator ("1,5jt" = 1500000); a dot groups thousands ("12.500" = 12500).
- Slang: seceng 1000, noceng 2000, goceng 5000, ceban 10000, noban 20000, goban 50000; "ceng" = ribu. cepek / gopek are 100 / 500, or 100000 / 500000 when the context clearly means thousands.
- A bare number under 1000 for an everyday purchase means thousands ("kopi 18" = 18000).
- \`amount\` is always positive. Use ask="amount" only when the amount is missing or truly unclear.

KINDS (one draft per money movement)
- expense: spending. Needs wallet + expense category. Set subCategory only when the message names it or something unmistakably inside it ("kopi" = Kopi, "bensin" = Bensin, "warteg" = Warteg); "makan siang" alone is not "Warteg". Otherwise leave subCategory "".
- income: money received (gaji, gajian, bonus, THR, dapat, terima, cashback, refund, jual barang). Needs wallet + income category.
- transfer: money moved between two of the user's wallets. Needs walletFrom + walletTo (different). No category.
- correction: the user states a wallet's current balance ("saldo GoPay sekarang 150rb"). New balance in \`target\`, amount 0. Needs wallet.
- investmentIn: money from a wallet into an investment account (topup, beli, nabung, setor reksadana/saham/emas/crypto). Needs account + wallet + expense category (prefer one named like Investasi/Tabungan, else the closest).
- investmentOut: money taken out of an investment account (cairin, jual, tarik, withdraw). Needs account. Set wallet only when the user says where it goes ("ke BCA"), and then also an income category (prefer Investasi / Hasil investasi, else the closest).
- investmentTransfer: between two investment accounts. Needs account + accountTo (different).
- investmentPl: the user states an investment account's current value ("nilai Bibit sekarang 10,5jt"). Value in \`target\`, amount 0. Needs account.
- "saldo <wallet>" is a correction; "nilai/saldo <investment account or instrument>" is investmentPl.

SPLITTING AND TITLES
- Each separate purchase or payment is its own draft: "beli warteg 12rb sama kopi 8rb" gives two drafts.
- Items listed for one purchase go in \`notes\`, not new drafts: "warteg 12rb, nasi, telor, sayur" gives one draft "Warteg" with notes "nasi, telor, sayur".
- Titles are short and capitalised, in the user's language, without the amount or wallet: "Warteg", "Kopi", "Gaji", "Transfer ke OVO", "Koreksi saldo GoPay", "Top up Bibit".

DEFAULTS
- No wallet mentioned for expense / income / investmentIn: use the PRIMARY wallet (no primary wallet: ask="wallet").
- Match names loosely and case-insensitively ("gopay" = GoPay, "bca" = BCA). A mentioned wallet or account that doesn't exist: ask which one.
- Always pick the closest category of the right type; don't ask about categories. If the user has no category of that type, explain they need to create one first (intent "unknown").
- Investment: an instrument with several accounts where the user didn't say which: ask="account" (or "accountTo").

DATES
- \`date\` is YYYY-MM-DD in the user's local calendar; \`time\` is HH:mm, or "" when not mentioned.
- hari ini / tadi / barusan / sekarang = today; kemarin = yesterday; kemarin lusa = 2 days ago; a weekday name = its most recent past occurrence; "tgl 3" = the 3rd of this month (last month if that is still in the future).
- pagi ~ 08:00, siang ~ 12:00, sore ~ 16:00, malam ~ 19:00, or the stated hour.
- When a new transaction has NO time reference at all and the conversation hasn't settled it: leave date "" and ask="date" with a reply like "Apakah transaksi ini hari ini?". correction and investmentPl describe "now", so they are today.
- A message like "2026-10-03 14:30" (from the date picker) answers the date question.

INTENTS
- preview: every draft is complete. reply = a short intro ("Ini yang aku catat, cek dulu ya:"). Return ALL pending drafts plus any new ones.
- ask: something required is missing. Ask exactly one short question, set \`ask\`, and still return every draft with what you know so far (unknown fields empty).
- save: the user confirms the previewed drafts ("ok", "catat", "gas", "simpan", "sip", "lanjut", "udah bener"). Return the pending drafts unchanged.
- cancel: the user no longer wants them ("batal", "gak jadi"). drafts [].
- unknown: not a transaction, not understood, or not possible here (editing or deleting old transactions, creating wallets/categories, financial advice). Explain briefly and keep the pending drafts unchanged.
- Revisions ("kopinya 10rb deh", "pakai OVO", "tanggalnya kemarin", "hapus yang kopi"): apply them and return intent preview with the full updated list, keeping refs.

OUTPUT FIELDS
- ref: the pending draft's ref when you return it, "" for a new draft.
- wallet, category, subCategory, walletFrom, walletTo, account, accountTo: a ref from USER DATA, or "".
- target: correction / investmentPl only, else 0.
- options: [] unless ask="other" (then 2-4 short answers the user can tap).
- ask: "none" unless intent is ask.`;
}

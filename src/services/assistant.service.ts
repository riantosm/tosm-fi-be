import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { CategoryModel } from "../models/category.model";
import { InstrumentModel } from "../models/instrument.model";
import { WalletModel } from "../models/wallet.model";
import { createCore as createTransactionCore } from "./transaction.service";
import {
  createMoneyInCore,
  createMoneyOutCore,
  createProfitLossCore,
  createTransferCore,
} from "./investment-transaction.service";
import { completeJson, LlmMessage } from "../utils/llm";
import {
  AskField,
  buildSystemPrompt,
  DRAFT_KINDS,
  ModelDraft,
  ModelOutput,
  OUTPUT_SCHEMA,
} from "../utils/assistantPrompt";
import { instantToLocalFieldsDate, shiftToInstant } from "../utils/timezone";
import {
  AssistantDraftKind,
  AssistantLanguage,
  IAssistantChatInput,
  IAssistantCommitResult,
  IAssistantDraft,
  IAssistantHistoryItem,
  IAssistantQuickReply,
  IAssistantReply,
} from "../interfaces/assistant.interface";
import { ISafeTransaction } from "../interfaces/transaction.interface";
import { ISafeInvestmentTransaction } from "../interfaces/investment-transaction.interface";

// ---------------------------------------------------------------------------
// Copy (the assistant's own lines + validation messages), per app language.
// ---------------------------------------------------------------------------

type Copy = {
  locale: string;
  today: string;
  yesterday: string;
  pickDate: string;
  previewIntro: string;
  askDate: string;
  askAmount: string;
  askWallet: string;
  askWalletFrom: string;
  askWalletTo: string;
  askAccount: string;
  cancelled: string;
  nothingToSave: string;
  fixFirst: string;
  notUnderstood: string;
  examples: string[];
  transferTo: (name: string) => string;
  correction: (name: string) => string;
  topUp: (name: string) => string;
  withdraw: (name: string) => string;
  update: (name: string) => string;
  untitled: string;
  amountMissing: string;
  walletMissing: string;
  walletFromMissing: string;
  walletToMissing: string;
  sameWallet: string;
  categoryMissing: string;
  categoryWrongType: (name: string, type: "income" | "expense") => string;
  accountMissing: string;
  sameAccount: string;
  overAccount: (name: string, value: string) => string;
  balanceUnchanged: (name: string, value: string) => string;
  valueUnchanged: (name: string, value: string) => string;
  negativeValue: string;
};

const COPY: Record<AssistantLanguage, Copy> = {
  id: {
    locale: "id-ID",
    today: "Ya, hari ini",
    yesterday: "Kemarin",
    pickDate: "Pilih tanggal",
    previewIntro: "Ini yang aku catat, cek dulu ya:",
    askDate: "Apakah transaksi ini hari ini?",
    askAmount: "Nominalnya berapa?",
    askWallet: "Pakai dompet mana?",
    askWalletFrom: "Transfernya dari dompet mana?",
    askWalletTo: "Transfernya ke dompet mana?",
    askAccount: "Akun investasi yang mana?",
    cancelled: "Oke, nggak jadi dicatat.",
    nothingToSave: "Belum ada yang bisa disimpan. Mau catat apa?",
    fixFirst: "Masih ada yang perlu dibetulin dulu sebelum disimpan.",
    notUnderstood:
      "Hmm, aku belum nangkep maksudnya. Coba tulis apa, berapa, dan dompetnya kalau perlu. Misalnya:",
    examples: ["Makan siang 25rb", "Gajian 8jt masuk BCA", "Transfer 100rb ke GoPay"],
    transferTo: (name) => `Transfer ke ${name}`,
    correction: (name) => `Koreksi saldo ${name}`,
    topUp: (name) => `Top up ${name}`,
    withdraw: (name) => `Tarik dana ${name}`,
    update: (name) => `Update nilai ${name}`,
    untitled: "Transaksi",
    amountMissing: "Nominalnya belum ada.",
    walletMissing: "Dompetnya belum dipilih.",
    walletFromMissing: "Dompet asalnya belum dipilih.",
    walletToMissing: "Dompet tujuannya belum dipilih.",
    sameWallet: "Dompet asal dan tujuan nggak boleh sama.",
    categoryMissing: "Kategorinya belum dipilih.",
    categoryWrongType: (name, type) =>
      `${name} bukan kategori ${type === "expense" ? "pengeluaran" : "pemasukan"}.`,
    accountMissing: "Akun investasinya belum dipilih.",
    sameAccount: "Akun asal dan tujuan nggak boleh sama.",
    overAccount: (name, value) => `Saldo akun ${name} cuma ${value}.`,
    balanceUnchanged: (name, value) => `Saldo ${name} memang sudah ${value}.`,
    valueUnchanged: (name, value) => `Nilai ${name} memang sudah ${value}.`,
    negativeValue: "Nilainya nggak boleh minus.",
  },
  en: {
    locale: "en-US",
    today: "Yes, today",
    yesterday: "Yesterday",
    pickDate: "Pick a date",
    previewIntro: "Here's what I've got, please check:",
    askDate: "Did this happen today?",
    askAmount: "How much was it?",
    askWallet: "Which wallet?",
    askWalletFrom: "Which wallet is the transfer from?",
    askWalletTo: "Which wallet is the transfer to?",
    askAccount: "Which investment account?",
    cancelled: "Okay, I won't record it.",
    nothingToSave: "There's nothing to save yet. What would you like to record?",
    fixFirst: "A few things need fixing before I can save.",
    notUnderstood:
      "Hmm, I didn't catch that. Try writing what, how much, and the wallet if needed. For example:",
    examples: ["Lunch 25k", "Salary 8M into BCA", "Transfer 100k to GoPay"],
    transferTo: (name) => `Transfer to ${name}`,
    correction: (name) => `Balance correction ${name}`,
    topUp: (name) => `Top up ${name}`,
    withdraw: (name) => `Withdraw ${name}`,
    update: (name) => `Value update ${name}`,
    untitled: "Transaction",
    amountMissing: "The amount is missing.",
    walletMissing: "No wallet selected.",
    walletFromMissing: "No source wallet selected.",
    walletToMissing: "No destination wallet selected.",
    sameWallet: "Source and destination wallets must differ.",
    categoryMissing: "No category selected.",
    categoryWrongType: (name, type) => `${name} isn't an ${type} category.`,
    accountMissing: "No investment account selected.",
    sameAccount: "Source and destination accounts must differ.",
    overAccount: (name, value) => `${name} only holds ${value}.`,
    balanceUnchanged: (name, value) => `${name} is already ${value}.`,
    valueUnchanged: (name, value) => `${name} is already worth ${value}.`,
    negativeValue: "The value can't be negative.",
  },
  jp: {
    locale: "ja-JP",
    today: "はい、今日",
    yesterday: "昨日",
    pickDate: "日付を選ぶ",
    previewIntro: "こちらで記録します。確認してください：",
    askDate: "この取引は今日ですか？",
    askAmount: "金額はいくらですか？",
    askWallet: "どの財布を使いますか？",
    askWalletFrom: "どの財布から振り替えますか？",
    askWalletTo: "どの財布へ振り替えますか？",
    askAccount: "どの投資口座ですか？",
    cancelled: "わかりました、記録しません。",
    nothingToSave: "まだ保存するものがありません。何を記録しますか？",
    fixFirst: "保存する前に直すところがあります。",
    notUnderstood: "うまく読み取れませんでした。内容と金額、必要なら財布も書いてください。例：",
    examples: ["ランチ 1500円", "給料 25万 BCAに入金", "GoPayへ 1万 振替"],
    transferTo: (name) => `${name}へ振替`,
    correction: (name) => `残高調整 ${name}`,
    topUp: (name) => `${name}に入金`,
    withdraw: (name) => `${name}から引き出し`,
    update: (name) => `評価額更新 ${name}`,
    untitled: "取引",
    amountMissing: "金額がありません。",
    walletMissing: "財布が選ばれていません。",
    walletFromMissing: "振替元の財布が選ばれていません。",
    walletToMissing: "振替先の財布が選ばれていません。",
    sameWallet: "振替元と振替先は別の財布にしてください。",
    categoryMissing: "カテゴリが選ばれていません。",
    categoryWrongType: (name, type) => `${name}は${type === "expense" ? "支出" : "収入"}カテゴリではありません。`,
    accountMissing: "投資口座が選ばれていません。",
    sameAccount: "振替元と振替先は別の口座にしてください。",
    overAccount: (name, value) => `${name}の残高は${value}だけです。`,
    balanceUnchanged: (name, value) => `${name}はすでに${value}です。`,
    valueUnchanged: (name, value) => `${name}の評価額はすでに${value}です。`,
    negativeValue: "マイナスの値は使えません。",
  },
};

// ---------------------------------------------------------------------------
// Context: the user's own wallets/categories/accounts, with the short refs
// the model works with.
// ---------------------------------------------------------------------------

interface WalletEntry {
  ref: string;
  id: string;
  name: string;
  color: string;
  balance: number;
  isPrimary: boolean;
}

interface CategoryEntry {
  ref: string;
  id: string;
  name: string;
  type: "income" | "expense";
  color: string;
  subs: { ref: string; id: string; name: string }[];
}

interface AccountEntry {
  ref: string;
  idInstrument: string;
  idAccount: string;
  instrument: string;
  account: string;
  color: string;
  currentValue: number;
}

interface Context {
  copy: Copy;
  language: AssistantLanguage;
  tzOffsetMinutes: number;
  nowLocal: Date;
  wallets: WalletEntry[];
  categories: CategoryEntry[];
  accounts: AccountEntry[];
}

async function loadContext(
  idUser: string,
  language: AssistantLanguage,
  tzOffsetMinutes: number
): Promise<Context> {
  const [wallets, categories, instruments] = await Promise.all([
    WalletModel.find({ idUser }).sort({ order: 1 }).lean(),
    CategoryModel.find({ idUser }).sort({ order: 1 }).lean(),
    InstrumentModel.find({ idUser }).sort({ createdAt: 1 }).lean(),
  ]);

  const accounts: AccountEntry[] = [];
  for (const instrument of instruments) {
    for (const account of instrument.investmentAccounts) {
      if (account.isDeleted) continue;
      accounts.push({
        ref: `A${accounts.length + 1}`,
        idInstrument: instrument._id.toString(),
        idAccount: (account as any)._id.toString(),
        instrument: instrument.nameInstrument,
        account: account.nameInvestmentAccount,
        color: instrument.color,
        currentValue: account.currentValue,
      });
    }
  }

  return {
    copy: COPY[language],
    language,
    tzOffsetMinutes,
    nowLocal: instantToLocalFieldsDate(new Date(), tzOffsetMinutes),
    wallets: wallets.map((wallet, i) => ({
      ref: `W${i + 1}`,
      id: wallet._id.toString(),
      name: wallet.nameWallet,
      color: wallet.color,
      balance: wallet.balance,
      isPrimary: wallet.isPrimary,
    })),
    categories: categories.map((category, i) => ({
      ref: `C${i + 1}`,
      id: category._id.toString(),
      name: category.nameCategory,
      type: category.type,
      color: category.color,
      subs: [...category.subCategories]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((sub, j) => ({
          ref: `C${i + 1}.${j + 1}`,
          id: (sub as any)._id.toString(),
          name: sub.nameSubCategory,
        })),
    })),
    accounts,
  };
}

const primaryWallet = (ctx: Context) => ctx.wallets.find((w) => w.isPrimary);
const walletById = (ctx: Context, id: string | null) => ctx.wallets.find((w) => w.id === id);
const categoryById = (ctx: Context, id: string | null) => ctx.categories.find((c) => c.id === id);
const accountById = (ctx: Context, id: string | null) => ctx.accounts.find((a) => a.idAccount === id);

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The model is told to answer with refs, but tolerate it echoing a name instead.
function resolveWallet(ctx: Context, value: string): WalletEntry | undefined {
  if (!value.trim()) return undefined;
  return ctx.wallets.find((w) => same(w.ref, value)) ?? ctx.wallets.find((w) => same(w.name, value));
}

function resolveAccount(ctx: Context, value: string): AccountEntry | undefined {
  if (!value.trim()) return undefined;
  return (
    ctx.accounts.find((a) => same(a.ref, value)) ?? ctx.accounts.find((a) => same(a.account, value))
  );
}

function resolveCategory(
  ctx: Context,
  categoryValue: string,
  subValue: string
): { category?: CategoryEntry; subId: string | null } {
  for (const category of ctx.categories) {
    const sub = category.subs.find((s) => subValue.trim() && (same(s.ref, subValue) || same(s.name, subValue)));
    if (sub && (!categoryValue.trim() || same(category.ref, categoryValue) || same(category.name, categoryValue))) {
      return { category, subId: sub.id };
    }
  }
  const category = categoryValue.trim()
    ? (ctx.categories.find((c) => same(c.ref, categoryValue)) ??
      ctx.categories.find((c) => same(c.name, categoryValue)))
    : undefined;
  return { category, subId: null };
}

// ---------------------------------------------------------------------------
// Dates: the model speaks local "YYYY-MM-DD" + "HH:mm"; drafts carry ISO.
// ---------------------------------------------------------------------------

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const HM_RE = /^(\d{1,2}):(\d{2})$/;

function localParts(iso: string, ctx: Context): { date: string; time: string } {
  const local = instantToLocalFieldsDate(new Date(iso), ctx.tzOffsetMinutes).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** Local date + optional time → ISO instant. No time: the current local time of day on that date. */
function localToIso(date: string, time: string, ctx: Context): string {
  const [y, m, d] = date.split("-").map(Number);
  const hm = time.trim().match(HM_RE);
  const hours = hm ? Math.min(Number(hm[1]), 23) : ctx.nowLocal.getUTCHours();
  const minutes = hm ? Math.min(Number(hm[2]), 59) : ctx.nowLocal.getUTCMinutes();
  return shiftToInstant(new Date(Date.UTC(y, m - 1, d, hours, minutes)), ctx.tzOffsetMinutes).toISOString();
}

// ---------------------------------------------------------------------------
// Draft <-> model draft
// ---------------------------------------------------------------------------

const hasTarget = (kind: AssistantDraftKind) => kind === "correction" || kind === "investmentPl";
const round2 = (value: number) => Math.round(value * 100) / 100;
const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function toModelDraft(draft: IAssistantDraft, ref: string, ctx: Context): ModelDraft {
  const local = localParts(draft.date, ctx);
  const dateMissing = draft.missing?.includes("date") ?? false;
  const category = categoryById(ctx, draft.idCategory);
  const sub = category?.subs.find((s) => s.id === draft.idSubCategory);
  return {
    ref,
    kind: draft.kind,
    title: draft.title,
    amount: hasTarget(draft.kind) ? 0 : draft.amount,
    target: hasTarget(draft.kind) ? finite(draft.balanceAfter) : 0,
    date: dateMissing ? "" : local.date,
    time: dateMissing ? "" : local.time,
    notes: draft.notes,
    wallet: walletById(ctx, draft.idWallet)?.ref ?? "",
    category: category?.ref ?? "",
    subCategory: sub?.ref ?? "",
    walletFrom: walletById(ctx, draft.idWalletFrom)?.ref ?? "",
    walletTo: walletById(ctx, draft.idWalletTo)?.ref ?? "",
    account: accountById(ctx, draft.idInvestmentAccount)?.ref ?? "",
    accountTo: accountById(ctx, draft.idInvestmentAccountTo)?.ref ?? "",
  };
}

function defaultTitle(draft: IAssistantDraft, ctx: Context): string {
  const { copy } = ctx;
  const account = accountById(ctx, draft.idInvestmentAccount)?.account ?? "";
  switch (draft.kind) {
    case "income":
    case "expense": {
      const category = categoryById(ctx, draft.idCategory);
      const sub = category?.subs.find((s) => s.id === draft.idSubCategory);
      return sub?.name ?? category?.name ?? copy.untitled;
    }
    case "transfer":
      return copy.transferTo(walletById(ctx, draft.idWalletTo)?.name ?? "");
    case "correction":
      return copy.correction(walletById(ctx, draft.idWallet)?.name ?? "");
    case "investmentIn":
      return copy.topUp(account);
    case "investmentOut":
      return copy.withdraw(account);
    case "investmentTransfer":
      return copy.transferTo(accountById(ctx, draft.idInvestmentAccountTo)?.account ?? "");
    case "investmentPl":
      return copy.update(account);
  }
}

function fromModelDraft(
  model: ModelDraft,
  ctx: Context,
  pendingByRef: Map<string, IAssistantDraft>
): IAssistantDraft {
  const kind = DRAFT_KINDS.includes(model.kind) ? model.kind : "expense";
  const previous = pendingByRef.get(model.ref.trim().toUpperCase());
  const dateGiven = YMD_RE.test(model.date.trim());
  const date = dateGiven ? model.date.trim() : ctx.nowLocal.toISOString().slice(0, 10);
  // A revision that doesn't mention the time keeps the draft's earlier time.
  const time = HM_RE.test(model.time.trim())
    ? model.time
    : previous && dateGiven
      ? localParts(previous.date, ctx).time
      : "";

  const draft: IAssistantDraft = {
    idDraft: previous?.idDraft ?? randomUUID(),
    kind,
    title: model.title.trim().slice(0, 120),
    amount: round2(Math.abs(finite(model.amount))),
    date: localToIso(date, dateGiven ? time : "", ctx),
    notes: model.notes.trim().slice(0, 500),
    idWallet: null,
    idCategory: null,
    idSubCategory: null,
    idWalletFrom: null,
    idWalletTo: null,
    idInstrument: null,
    idInvestmentAccount: null,
    idInstrumentTo: null,
    idInvestmentAccountTo: null,
  };

  const wallet = resolveWallet(ctx, model.wallet);
  const { category, subId } = resolveCategory(ctx, model.category, model.subCategory);
  const account = resolveAccount(ctx, model.account);
  const setCategory = () => {
    draft.idCategory = category?.id ?? null;
    draft.idSubCategory = category ? subId : null;
  };
  const setAccount = () => {
    draft.idInstrument = account?.idInstrument ?? null;
    draft.idInvestmentAccount = account?.idAccount ?? null;
  };

  switch (kind) {
    case "income":
    case "expense":
    case "investmentIn":
      draft.idWallet = (wallet ?? primaryWallet(ctx))?.id ?? null;
      setCategory();
      if (kind === "investmentIn") setAccount();
      break;
    case "transfer":
      draft.idWalletFrom = resolveWallet(ctx, model.walletFrom)?.id ?? null;
      draft.idWalletTo = resolveWallet(ctx, model.walletTo)?.id ?? null;
      break;
    case "correction":
      draft.idWallet = wallet?.id ?? null;
      draft.balanceBefore = wallet?.balance ?? 0;
      draft.balanceAfter = round2(finite(model.target));
      draft.amount = round2(Math.abs(draft.balanceAfter - draft.balanceBefore));
      break;
    case "investmentOut":
      setAccount();
      if (wallet) {
        draft.idWallet = wallet.id;
        setCategory();
      }
      break;
    case "investmentTransfer": {
      setAccount();
      const to = resolveAccount(ctx, model.accountTo);
      draft.idInstrumentTo = to?.idInstrument ?? null;
      draft.idInvestmentAccountTo = to?.idAccount ?? null;
      break;
    }
    case "investmentPl":
      setAccount();
      draft.balanceBefore = account?.currentValue ?? 0;
      draft.balanceAfter = round2(finite(model.target));
      draft.amount = round2(Math.abs(draft.balanceAfter - draft.balanceBefore));
      break;
  }

  if (!draft.title) draft.title = defaultTitle(draft, ctx);
  // correction / investmentPl describe "now"; everything else needs a date from the user.
  if (!dateGiven && !hasTarget(kind)) draft.missing = ["date"];
  return draft;
}

// ---------------------------------------------------------------------------
// Validation (what blocks Simpan) and what's still worth asking about
// ---------------------------------------------------------------------------

/** Required info the user hasn't given: turned into a question instead of a red row. */
function missingField(draft: IAssistantDraft): AskField | null {
  if (draft.missing?.includes("date")) return "date";
  if (!hasTarget(draft.kind) && draft.amount <= 0) return "amount";
  switch (draft.kind) {
    case "transfer":
      if (!draft.idWalletFrom) return "walletFrom";
      if (!draft.idWalletTo) return "walletTo";
      return null;
    case "income":
    case "expense":
    case "correction":
      return draft.idWallet ? null : "wallet";
    case "investmentIn":
      if (!draft.idInvestmentAccount) return "account";
      return draft.idWallet ? null : "wallet";
    case "investmentTransfer":
      if (!draft.idInvestmentAccount) return "account";
      return draft.idInvestmentAccountTo ? null : "accountTo";
    case "investmentOut":
    case "investmentPl":
      return draft.idInvestmentAccount ? null : "account";
  }
}

function money(value: number, ctx: Context): string {
  return new Intl.NumberFormat(ctx.copy.locale, { maximumFractionDigits: 2 }).format(value);
}

function validateDraft(draft: IAssistantDraft, ctx: Context): string | undefined {
  const { copy } = ctx;
  if (!hasTarget(draft.kind) && draft.amount <= 0) return copy.amountMissing;

  const needCategory = (type: "income" | "expense") => {
    const category = categoryById(ctx, draft.idCategory);
    if (!category) return copy.categoryMissing;
    if (category.type !== type) return copy.categoryWrongType(category.name, type);
    return undefined;
  };
  const account = accountById(ctx, draft.idInvestmentAccount);

  switch (draft.kind) {
    case "income":
    case "expense":
      if (!walletById(ctx, draft.idWallet)) return copy.walletMissing;
      return needCategory(draft.kind);
    case "transfer":
      if (!walletById(ctx, draft.idWalletFrom)) return copy.walletFromMissing;
      if (!walletById(ctx, draft.idWalletTo)) return copy.walletToMissing;
      if (draft.idWalletFrom === draft.idWalletTo) return copy.sameWallet;
      return undefined;
    case "correction": {
      const wallet = walletById(ctx, draft.idWallet);
      if (!wallet) return copy.walletMissing;
      if (draft.balanceAfter === wallet.balance) {
        return copy.balanceUnchanged(wallet.name, money(wallet.balance, ctx));
      }
      return undefined;
    }
    case "investmentIn":
      if (!account) return copy.accountMissing;
      if (!walletById(ctx, draft.idWallet)) return copy.walletMissing;
      return needCategory("expense");
    case "investmentOut":
      if (!account) return copy.accountMissing;
      if (draft.amount > account.currentValue) {
        return copy.overAccount(account.account, money(account.currentValue, ctx));
      }
      return draft.idWallet ? needCategory("income") : undefined;
    case "investmentTransfer":
      if (!account || !accountById(ctx, draft.idInvestmentAccountTo)) return copy.accountMissing;
      if (draft.idInvestmentAccount === draft.idInvestmentAccountTo) return copy.sameAccount;
      if (draft.amount > account.currentValue) {
        return copy.overAccount(account.account, money(account.currentValue, ctx));
      }
      return undefined;
    case "investmentPl":
      if (!account) return copy.accountMissing;
      if ((draft.balanceAfter ?? 0) < 0) return copy.negativeValue;
      if (draft.balanceAfter === account.currentValue) {
        return copy.valueUnchanged(account.account, money(account.currentValue, ctx));
      }
      return undefined;
  }
}

/** Which fields a revision touched — drives the preview's "old → new" chips. */
function changedFields(previous: IAssistantDraft, next: IAssistantDraft, ctx: Context): string[] {
  const changed: string[] = [];
  if (previous.amount !== next.amount || previous.balanceAfter !== next.balanceAfter) changed.push("amount");
  if (
    previous.idWallet !== next.idWallet ||
    previous.idWalletFrom !== next.idWalletFrom ||
    previous.idWalletTo !== next.idWalletTo
  ) {
    changed.push("wallet");
  }
  if (previous.idCategory !== next.idCategory || previous.idSubCategory !== next.idSubCategory) {
    changed.push("category");
  }
  if (
    previous.idInvestmentAccount !== next.idInvestmentAccount ||
    previous.idInvestmentAccountTo !== next.idInvestmentAccountTo
  ) {
    changed.push("account");
  }
  if (localParts(previous.date, ctx).date !== localParts(next.date, ctx).date) changed.push("date");
  if (previous.title !== next.title) changed.push("title");
  return changed;
}

function compact(value: number, ctx: Context): string {
  return new Intl.NumberFormat(ctx.copy.locale, { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

function quickRepliesFor(
  ask: AskField,
  drafts: IAssistantDraft[],
  options: string[],
  lastUserText: string,
  ctx: Context
): IAssistantQuickReply[] | undefined {
  const { copy } = ctx;
  switch (ask) {
    case "date":
      return [{ label: copy.today }, { label: copy.yesterday }, { label: copy.pickDate, icon: "calendar" }];
    case "wallet":
    case "walletFrom":
    case "walletTo": {
      const otherLeg = new Set(
        drafts.map((d) => (ask === "walletFrom" ? d.idWalletTo : ask === "walletTo" ? d.idWalletFrom : null))
      );
      return ctx.wallets
        .filter((w) => !otherLeg.has(w.id))
        .slice(0, 6)
        .map((w) => ({ label: w.name, dot: w.color }));
    }
    case "account":
    case "accountTo": {
      const text = lastUserText.toLowerCase();
      const mentioned = ctx.accounts.filter((a) => text.includes(a.instrument.toLowerCase()));
      const otherLeg = new Set(
        drafts.map((d) => (ask === "accountTo" ? d.idInvestmentAccount : d.idInvestmentAccountTo))
      );
      return (mentioned.length ? mentioned : ctx.accounts)
        .filter((a) => !otherLeg.has(a.idAccount))
        .slice(0, 6)
        .map((a) => ({
          label: `${a.account} · ${compact(a.currentValue, ctx)}`,
          value: `${a.instrument} ${a.account}`,
          dot: a.color,
        }));
    }
    case "other":
      return options
        .map((option) => option.trim())
        .filter(Boolean)
        .slice(0, 4)
        .map((label) => ({ label }));
    default:
      return undefined;
  }
}

const ASK_COPY: Partial<Record<AskField, keyof Copy>> = {
  date: "askDate",
  amount: "askAmount",
  wallet: "askWallet",
  walletFrom: "askWalletFrom",
  walletTo: "askWalletTo",
  account: "askAccount",
  accountTo: "askAccount",
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

// Answers decided without spending an AI request. Deliberately strict (the
// whole message must be a confirmation) so "ok tapi kopinya 10rb" still goes
// to the model as a revision.
const CONFIRM_RE =
  /^(ok(e|ey|ay)?|okk+|catat(in|kan)?|simpan|simpen|save|gas+|sip+|siap|lanjut(kan)?|mantap|yes|yoi|bener|benar|betul|udah bener|sudah benar|confirm|はい|保存)(\s*[,.]?\s*(catat(in|kan)?|simpan|simpen|save|aja|deh|dong|ya|gas+|sip+|lanjut|ok(e)?))*\s*[.!]*$/i;
const CANCEL_RE =
  /^(batal(in|kan)?|cancel|(gak|ga|nggak|ngga|enggak|engga|tidak|gk|g) (jadi|usah)|キャンセル|やめる)\b[\s\S]{0,20}$/i;

// "Did this happen today?" for a transaction with no time reference is an
// explicit product rule, so it's enforced here instead of trusting the model
// (which tends to assume today). Meal names aren't time references.
const MEAL_RE = /\bmakan\s+(pagi|siang|malam)\b/gi;
const TIME_WORDS_RE =
  /\b(hari ini|tadi|barusan|baru aja|sekarang|kemarin|kemaren|kmrn|lusa|semalam|pagi|siang|sore|malam|subuh|senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|ahad|tgl|tanggal|jam|pukul|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|today|yesterday|tonight|morning|afternoon|evening|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday|ago|last week)\b|\d{4}-\d{2}-\d{2}|\b\d{1,2}\/\d{1,2}\b/i;
const TIME_WORDS_JP_RE = /今日|昨日|一昨日|今朝|今夜|昨夜|曜日|\d+月\d+日|\d+日/;
const YES_TODAY_RE = /^(iya+|ya+|yes|yep|yup|yap|betul|bener|benar|ok(e|ay)?|sip|hari ini|today)\b|^(はい|今日)/i;

function mentionsTime(text: string): boolean {
  const clean = text.replace(MEAL_RE, " ");
  return TIME_WORDS_RE.test(clean) || TIME_WORDS_JP_RE.test(clean);
}

/**
 * Marks drafts whose date the user hasn't actually given (yet) as missing a
 * date. A new item added to a conversation that already settled its date
 * ("eh kopinya juga 8rb") keeps the model's date, which follows that context.
 */
function enforceDateRule(
  drafts: IAssistantDraft[],
  pending: IAssistantDraft[],
  lastUserText: string
) {
  const timeGiven = mentionsTime(lastUserText);
  const answeredToday = YES_TODAY_RE.test(lastUserText.trim());
  const conversationHasDate = pending.some(
    (p) => !hasTarget(p.kind) && !p.missing?.includes("date")
  );

  for (const draft of drafts) {
    if (hasTarget(draft.kind)) {
      delete draft.missing;
      continue;
    }
    const modelGaveDate = !draft.missing?.includes("date");
    const previous = pending.find((p) => p.idDraft === draft.idDraft);

    if (!previous) {
      if (!modelGaveDate || !(timeGiven || conversationHasDate)) draft.missing = ["date"];
    } else if (previous.missing?.includes("date")) {
      if (modelGaveDate && (timeGiven || answeredToday)) delete draft.missing;
      else draft.missing = ["date"];
    } else if (!modelGaveDate) {
      // The date was settled earlier; the model just didn't repeat it.
      draft.date = previous.date;
      delete draft.missing;
    }
  }
}

function examplesReply(ctx: Context): IAssistantQuickReply[] {
  return ctx.copy.examples.map((label) => ({ label }));
}

function interpret(
  output: ModelOutput,
  input: IAssistantChatInput,
  ctx: Context,
  pendingByRef: Map<string, IAssistantDraft>,
  lastUserText: string
): IAssistantReply {
  const { copy } = ctx;
  const pending = input.drafts;
  const reply = output.reply.trim();

  if (output.intent === "cancel") return { intent: "cancel", reply: reply || copy.cancelled, drafts: [] };

  if (output.intent === "save" && input.hasPreview) {
    if (pending.length === 0) return { intent: "unknown", reply: copy.nothingToSave, drafts: [] };
    if (!pending.some((d) => d.error || d.missing?.length)) {
      return { intent: "save", reply: "", drafts: pending };
    }
    if (pending.some((d) => d.error)) return { intent: "unknown", reply: copy.fixFirst, drafts: pending };
    // Otherwise something is still missing: fall through and ask for it.
  }

  const drafts = (output.drafts ?? []).map((draft) => fromModelDraft(draft, ctx, pendingByRef));
  enforceDateRule(drafts, pending, lastUserText);

  if (output.intent === "unknown" || drafts.length === 0) {
    return {
      intent: "unknown",
      reply: output.intent === "unknown" && reply ? reply : copy.notUnderstood,
      drafts: pending,
      quickReplies: pending.length ? undefined : examplesReply(ctx),
    };
  }

  // Whatever the model decided, a draft still missing required info gets a
  // question (with the right quick replies) rather than a broken preview.
  const missing = drafts.map(missingField).find((field): field is AskField => field !== null);
  const ask = output.intent === "ask" && output.ask !== "none" ? output.ask : missing;
  if (ask) {
    const copyKey = ASK_COPY[ask];
    const useModelReply = output.intent === "ask" && reply && (!missing || ask === output.ask);
    return {
      intent: "ask",
      reply: useModelReply ? reply : copyKey ? (copy[copyKey] as string) : reply,
      drafts,
      quickReplies: quickRepliesFor(ask, drafts, output.options ?? [], lastUserText, ctx),
    };
  }

  for (const draft of drafts) {
    const error = validateDraft(draft, ctx);
    if (error) draft.error = error;
    const previous = pending.find((p) => p.idDraft === draft.idDraft);
    if (previous && input.hasPreview) {
      const changed = changedFields(previous, draft, ctx);
      if (changed.length) draft.changed = changed;
    }
  }
  return { intent: "preview", reply: reply || copy.previewIntro, drafts };
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

// Corrections and value updates state an END state ("saldo GoPay sekarang
// 150rb"), so they run after every other movement in the batch.
const COMMIT_RANK: Record<AssistantDraftKind, number> = {
  income: 0,
  expense: 0,
  transfer: 0,
  investmentIn: 0,
  investmentOut: 0,
  investmentTransfer: 0,
  correction: 1,
  investmentPl: 1,
};

function requireId(value: string | null, label: string): string {
  if (!value) throw new Error(`${label} wajib diisi`);
  return value;
}

async function commitDraft(
  idUser: string,
  draft: IAssistantDraft,
  session: mongoose.ClientSession,
  ctx: Context,
  transactions: ISafeTransaction[],
  investmentTransactions: ISafeInvestmentTransaction[]
): Promise<void> {
  const title = draft.title.trim() || ctx.copy.untitled;
  const base = { title, notes: draft.notes, date: draft.date };

  switch (draft.kind) {
    case "income":
    case "expense":
      transactions.push(
        await createTransactionCore(
          idUser,
          {
            ...base,
            type: draft.kind,
            amount: draft.amount,
            idWallet: draft.idWallet,
            idCategory: draft.idCategory,
            idSubCategory: draft.idSubCategory,
          },
          session
        )
      );
      return;

    case "transfer":
      transactions.push(
        await createTransactionCore(
          idUser,
          {
            ...base,
            type: "transfer",
            amount: draft.amount,
            idWalletFrom: draft.idWalletFrom,
            idWalletTo: draft.idWalletTo,
          },
          session
        )
      );
      return;

    case "correction": {
      // The delta is taken against the LIVE balance inside the session, so the
      // wallet really ends at the stated balance even after earlier drafts in
      // this batch moved it.
      const wallet = await WalletModel.findOne({
        _id: requireId(draft.idWallet, "idWallet"),
        idUser,
      }).session(session);
      if (!wallet) throw new Error("Wallet tidak ditemukan");
      const delta = round2(finite(draft.balanceAfter) - wallet.balance);
      if (delta === 0) throw new Error(ctx.copy.balanceUnchanged(wallet.nameWallet, money(wallet.balance, ctx)));
      transactions.push(
        await createTransactionCore(
          idUser,
          { ...base, type: "correction", amount: delta, idWallet: draft.idWallet },
          session
        )
      );
      return;
    }

    case "investmentIn": {
      // Same pair the manual "Catat sebagai Investasi" flow creates: a wallet
      // expense, then the ledger "in" row linked to it.
      const linked = await createTransactionCore(
        idUser,
        {
          ...base,
          type: "expense",
          amount: draft.amount,
          idWallet: draft.idWallet,
          idCategory: draft.idCategory,
          idSubCategory: draft.idSubCategory,
        },
        session
      );
      transactions.push(linked);
      investmentTransactions.push(
        await createMoneyInCore(
          idUser,
          {
            idInstrument: requireId(draft.idInstrument, "idInstrument"),
            idInvestmentAccount: requireId(draft.idInvestmentAccount, "idInvestmentAccount"),
            amount: draft.amount,
            date: draft.date,
            idTransaction: linked.idTransaction,
          },
          session
        )
      );
      return;
    }

    case "investmentOut": {
      // Same as WithdrawalFormModal: optional linked wallet income first.
      let idTransaction: string | null = null;
      if (draft.idWallet) {
        const linked = await createTransactionCore(
          idUser,
          {
            ...base,
            type: "income",
            amount: draft.amount,
            idWallet: draft.idWallet,
            idCategory: draft.idCategory,
            idSubCategory: draft.idSubCategory,
          },
          session
        );
        transactions.push(linked);
        idTransaction = linked.idTransaction;
      }
      investmentTransactions.push(
        await createMoneyOutCore(
          idUser,
          {
            idInstrument: requireId(draft.idInstrument, "idInstrument"),
            idInvestmentAccount: requireId(draft.idInvestmentAccount, "idInvestmentAccount"),
            amount: draft.amount,
            date: draft.date,
            idTransaction,
            ...(draft.notes && { note: draft.notes }),
          },
          session
        )
      );
      return;
    }

    case "investmentTransfer":
      investmentTransactions.push(
        await createTransferCore(
          idUser,
          {
            idInstrument: requireId(draft.idInstrument, "idInstrument"),
            idInvestmentAccount: requireId(draft.idInvestmentAccount, "idInvestmentAccount"),
            idInstrumentTo: requireId(draft.idInstrumentTo, "idInstrumentTo"),
            idInvestmentAccountTo: requireId(draft.idInvestmentAccountTo, "idInvestmentAccountTo"),
            amount: draft.amount,
            date: draft.date,
          },
          session
        )
      );
      return;

    case "investmentPl":
      investmentTransactions.push(
        await createProfitLossCore(
          idUser,
          {
            idInstrument: requireId(draft.idInstrument, "idInstrument"),
            idInvestmentAccount: requireId(draft.idInvestmentAccount, "idInvestmentAccount"),
            newCurrentValue: finite(draft.balanceAfter),
            date: draft.date,
          },
          session
        )
      );
      return;
  }
}

// ---------------------------------------------------------------------------
// Request sanitising (both endpoints take drafts straight from the client)
// ---------------------------------------------------------------------------

const MAX_HISTORY = 20;
const MAX_TEXT = 1000;
const MAX_DRAFTS = 30;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asId = (value: unknown) =>
  typeof value === "string" && OBJECT_ID_RE.test(value) ? value : null;
const asOptionalNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export function sanitizeLanguage(value: unknown): AssistantLanguage {
  return value === "en" || value === "jp" ? value : "id";
}

export function sanitizeHistory(value: unknown): IAssistantHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is IAssistantHistoryItem =>
        Boolean(item) &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.text === "string" &&
        item.text.trim().length > 0
    )
    .slice(-MAX_HISTORY)
    .map((item) => ({ role: item.role, text: item.text.trim().slice(0, MAX_TEXT) }));
}

export function sanitizeDrafts(value: unknown): IAssistantDraft[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .slice(0, MAX_DRAFTS)
    .map((item: any) => {
      const date = new Date(asString(item.date));
      const draft: IAssistantDraft = {
        idDraft: asString(item.idDraft).slice(0, 64) || randomUUID(),
        kind: DRAFT_KINDS.includes(item.kind) ? item.kind : "expense",
        title: asString(item.title).slice(0, 120),
        amount: Math.abs(finite(item.amount)),
        date: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
        notes: asString(item.notes).slice(0, 500),
        idWallet: asId(item.idWallet),
        idCategory: asId(item.idCategory),
        idSubCategory: asId(item.idSubCategory),
        idWalletFrom: asId(item.idWalletFrom),
        idWalletTo: asId(item.idWalletTo),
        idInstrument: asId(item.idInstrument),
        idInvestmentAccount: asId(item.idInvestmentAccount),
        idInstrumentTo: asId(item.idInstrumentTo),
        idInvestmentAccountTo: asId(item.idInvestmentAccountTo),
      };
      const before = asOptionalNumber(item.balanceBefore);
      const after = asOptionalNumber(item.balanceAfter);
      if (before !== undefined) draft.balanceBefore = before;
      if (after !== undefined) draft.balanceAfter = after;
      if (typeof item.error === "string" && item.error) draft.error = item.error.slice(0, 200);
      if (Array.isArray(item.missing)) {
        draft.missing = item.missing.filter((field: unknown) => typeof field === "string");
      }
      return draft;
    });
}

// ---------------------------------------------------------------------------

export const AssistantService = {
  async chat(idUser: string, input: IAssistantChatInput): Promise<IAssistantReply> {
    const ctx = await loadContext(idUser, input.language, input.tzOffsetMinutes);
    const pending = input.drafts;
    const lastUserText = [...input.history].reverse().find((item) => item.role === "user")?.text ?? "";

    if (pending.length > 0) {
      const complete = !pending.some((d) => d.error || d.missing?.length);
      if (input.hasPreview && complete && CONFIRM_RE.test(lastUserText)) {
        return { intent: "save", reply: "", drafts: pending };
      }
      if (CANCEL_RE.test(lastUserText)) return { intent: "cancel", reply: ctx.copy.cancelled, drafts: [] };
    }

    const pendingByRef = new Map(pending.map((draft, i) => [`D${i + 1}`, draft] as const));
    const system = buildSystemPrompt({
      language: ctx.language,
      nowLocal: ctx.nowLocal,
      wallets: ctx.wallets,
      categories: ctx.categories,
      accounts: ctx.accounts,
      pending: [...pendingByRef].map(([ref, draft]) => toModelDraft(draft, ref, ctx)),
    });
    const messages: LlmMessage[] = [
      { role: "system", content: system },
      ...input.history.map((item) => ({ role: item.role, content: item.text })),
    ];

    const output = await completeJson<ModelOutput>({
      messages,
      schemaName: "catat_cepat",
      schema: OUTPUT_SCHEMA,
    });
    return interpret(output, input, ctx, pendingByRef, lastUserText);
  },

  /**
   * Saves a previewed batch in ONE session: wallet transactions, linked
   * investment ledger rows and every balance/count side effect commit or
   * roll back together. A failing draft's id is attached to the thrown error
   * so the frontend can mark that row.
   */
  async commit(
    idUser: string,
    drafts: IAssistantDraft[],
    language: AssistantLanguage,
    tzOffsetMinutes: number
  ): Promise<IAssistantCommitResult> {
    const ctx = await loadContext(idUser, language, tzOffsetMinutes);
    const ordered = [...drafts].sort((a, b) => COMMIT_RANK[a.kind] - COMMIT_RANK[b.kind]);

    const session = await mongoose.startSession();
    try {
      let result!: IAssistantCommitResult;
      await session.withTransaction(async () => {
        // Reset on every attempt: withTransaction re-runs this on transient errors.
        const transactions: ISafeTransaction[] = [];
        const investmentTransactions: ISafeInvestmentTransaction[] = [];
        for (const draft of ordered) {
          try {
            await commitDraft(idUser, draft, session, ctx, transactions, investmentTransactions);
          } catch (error) {
            if (error && typeof error === "object") (error as any).idDraft = draft.idDraft;
            throw error;
          }
        }
        result = { transactions, investmentTransactions };
      });
      return result;
    } finally {
      await session.endSession();
    }
  },
};

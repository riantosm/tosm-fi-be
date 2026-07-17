# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # ts-node-dev --respawn --transpile-only src/index.ts (nodemon.json also watches)
npm run build     # tsc (outputs to dist/)
npm run start     # node dist/index.js
```

There is no test suite/framework configured in this project.

Requires `.env` with `MONGO_URI`, `PORT`, `JWT_SECRET` (see `.env.example`).

## Architecture

Express + TypeScript + Mongoose (MongoDB) API. The **auth / user-approval domain** (register, login, logout, "who am I", admin approval of new users), the **wallet domain**, the **category domain**, and the **transaction domain** are implemented so far. `archive/` holds an earlier, unrelated iteration of this project (accounts/transactions domain, numeric ids, snake_case fields) — it's dead code, not imported by `app.ts` and not reused by the current transaction domain below; ignore it unless deliberately reviving that old iteration.

Sibling repo `../money-tracking` (React/Vite frontend) consumes this API for the auth domain only, via `http://localhost:3000/api` — see its own `CLAUDE.md` for how it's wired in.

### Naming convention

All entity fields are **camelCase** (`idUser`, `nameUser`), matching the money-tracking frontend's convention — not the snake_case (`id_user`, `name_account`) used by this project's own `archive/`. `idUser` is Mongoose's own `_id`, exposed as a string via `.toString()` — there's no separate custom id field or counter.

### Response envelope

Every response goes through `src/utils/responseHandler.ts`, producing `{ message, data, isSuccess, status }`. On error, `data.error` holds the same string as `message` (when an `error` is passed in) — see any `catch` block in `src/controllers/*.ts` for the pattern. Field is `isSuccess` (camelCase), not `is_success` or `success`.

### Auth / user-approval flow

- `UserModel` (`src/models/user.model.ts`): `nameUser`, `username` (the login identifier — there is no `email` field), `password` (bcrypt), `role: "admin" | "user"`, `status: "pending" | "active"`, `tokenValidAfter: Date | null`.
- **Register** (`POST /auth/register`): the very first user ever created auto-becomes an **active admin** (bootstrap, so there's always someone who can approve everyone else). Every user after that starts `pending`.
- **Login** (`POST /auth/login`) succeeds even for a `pending` user and returns a token — login itself doesn't gate on approval status.
- **`requireActiveUser`** (`src/middlewares/auth.middleware.ts`) is what actually blocks a pending user, on every other protected route, with `403 "Menunggu validasi"`. It re-fetches the user from the DB on *every* request rather than trusting the JWT payload, so an admin's `accept-user` call takes effect immediately — no need for the user to log in again for a new token.
- **Logout** (`POST /auth/logout`, `requireAuth` only — no active-status gate, since even a pending user should be able to invalidate their own token) stamps `tokenValidAfter = now()` on the user. `requireActiveUser` then rejects any token whose `iat` predates that stamp. This invalidates **every** token issued to that user at once (no per-session/per-device tracking) — the known tradeoff of doing this without a session store. If real per-device revocation is ever needed, the standard upgrade is short-lived access tokens + a server-tracked refresh token; not worth doing preemptively.
- Admin-only routes (`GET /user/get-list-user`, `POST /user/accept-user`) use `requireAdmin`, which checks the freshly-loaded user's role (via `requireActiveUser`), not the JWT's.
- Routes: `/api/auth/{register,login,logout}`, `/api/user/{me,get-list-user,accept-user}` (`src/routes/`).

### Wallet domain

- `WalletModel` (`src/models/wallet.model.ts`): `idUser` (owner, filters every query — wallets are per-user, never shared), `nameWallet`, `color`, `balance`, `transactionCount`, `isPrimary`, `order` (persists manual drag-to-reorder from the FE).
- `balance`/`transactionCount` are only ever mutated by the transaction domain (see below) — the wallet endpoints themselves never touch them except at creation (`balance` defaults from the create payload, `transactionCount` always starts at 0).
- Creating a wallet does **not** auto-mark it primary, even the first one for a user — the FE's `WalletFormModal` has an explicit "set as primary" action (`PATCH /wallets/:idWallet/primary`), matching the mock service's old behavior exactly.
- `PATCH /wallets/:idWallet/primary` unsets `isPrimary` on every other wallet for that user before setting it on the target, then returns the full list (not just the changed wallet) since two wallets' `isPrimary` flip at once.
- `PATCH /wallets/reorder` takes `orderedIds: string[]` and writes each wallet's `order` to its index in that array; `GET /wallets` always sorts by `order` ascending.
- Routes: `/api/wallets/{"", ":idWallet", ":idWallet/primary", "reorder"}` (`src/routes/wallet.routes.ts`) — `/reorder` is registered before the generic `/:idWallet` PATCH route, otherwise Express would match "reorder" as an `:idWallet` param.
- All wallet routes require `requireAuth` + `requireActiveUser` (any active user manages their own wallets) — no `requireAdmin`.

### Category domain

- `CategoryModel` (`src/models/category.model.ts`): `idUser` (owner, filters every query), `nameCategory`, `type: "income" | "expense"`, `color`, `icon`, `transactionCount`, `order` (drag-to-reorder among a user's categories). `subCategories` is an **embedded** Mongoose subdocument array, not a separate collection — a subcategory never exists outside its parent, so deleting a category cascades to its subcategories for free, and each subcategory has its own `nameSubCategory`, `icon`, `transactionCount`, `order` (drag-to-reorder within that category).
- `ICategory.subCategories` is typed as `Types.DocumentArray<ISubCategory>` (not a plain array) specifically so `.id()` (lookup by subdocument `_id`) and `.push()` are available on hydrated documents — a plain-array type would compile but lose those methods.
- `transactionCount` (both category- and subcategory-level) is only ever mutated by the transaction domain (see below) — the category endpoints themselves never touch it except at creation (always starts at 0).
- Subdocument removal uses `sub.deleteOne()` (Mongoose 8 API) followed by `category.save()` — the older `.remove()` subdocument method was dropped in Mongoose 7+.
- Routes: `/api/categories/{"", ":idCategory", "reorder", ":idCategory/subcategories", ":idCategory/subcategories/:idSubCategory", ":idCategory/subcategories/reorder"}` (`src/routes/category.routes.ts`) — both `/reorder` routes (category-level and subcategory-level) are registered before their respective generic `/:idCategory` or `/:idSubCategory` PATCH routes, same ordering gotcha as wallets.
- All category routes require `requireAuth` + `requireActiveUser` — no `requireAdmin`.

### Transaction domain

- `TransactionModel` (`src/models/transaction.model.ts`): `idUser` (owner), `type: "income" | "expense" | "transfer" | "correction"`, `idWallet`/`idCategory`/`idSubCategory`/`idWalletFrom`/`idWalletTo` (all nullable strings — which ones apply depends on `type`, exactly like the FE's `Transaction` type: transfer uses `idWalletFrom`/`idWalletTo` instead of `idWallet`, transfer/correction never carry a category), `title`, `notes`, `amount`, `date`. Indexed on `{ idUser, date }` (default sort/month filtering) and `{ idUser, idWallet }` / `{ idUser, idCategory }` (filter chips).
- **This domain is the sole owner of `Wallet.balance`/`Wallet.transactionCount` and `Category`/`SubCategory.transactionCount`** — every create/update/delete in `src/services/transaction.service.ts` computes the wallet balance delta and category/subcategory count delta (same four-case `type` switch the FE used to do client-side) and applies them with `$inc` **inside a Mongoose session transaction** (`mongoose.startSession()` + `session.withTransaction(...)`) alongside the transaction document write itself, so the transaction and its side effects always commit or roll back together. This requires a replica-set-backed MongoDB (the Atlas cluster this project points at always is one, even on the free tier) — a plain standalone `mongod` does not support multi-document transactions.
- `update`/`remove` never trust a client-supplied "previous" transaction — they load the existing document from the DB inside the same session, revert its effect, then (for update) apply the new one. This means the frontend never needs to keep the full transaction list loaded locally just to compute an edit/delete delta.
- Per-type validation (`validatePayload` in the service): income/expense require an owned `idWallet` + an owned `idCategory` whose `type` matches (`idSubCategory`, if given, must belong to that category), amount > 0; transfer requires two different owned wallets (`idWalletFrom` ≠ `idWalletTo`), amount > 0, no category; correction requires only an owned `idWallet`, and `amount` is a **signed delta** applied directly to the balance (can be negative) — matches the FE's `BalanceCorrectionModal`, which already computes `amount: newBalance - oldBalance` before sending it.
- `GET /transactions` supports `month` ("YYYY-MM"), `type` (`income|expense|transfer|correction`), `dateFrom`/`dateTo` ("YYYY-MM-DD", intersected with `month` if both given), `idWallet` (matches as the transaction's wallet **or** either transfer leg), `idCategory`, `idSubCategory`, `search` (case-insensitive, regex-escaped, over `title`+`notes`), and `sort` (`dateDesc|dateAsc|amountDesc|amountAsc`). `page`+`limit` are both optional — if either is omitted the endpoint returns the **entire** filtered/sorted result with no pagination metadata (used by the FE's full-history dashboard/report load); if both are given it paginates and also returns `total`/`totalPages`. The response `data` shape is always `{ transactions, total, page, limit, totalPages }` regardless of which mode was used, so callers don't need to branch on response shape. `summary` (income/expense/net/categoryBreakdown, from the exported `computeSummary`) is always computed over the full filtered set regardless of pagination — the FE's report page still exploits this directly for monthly trend (`month=X&page=1&limit=1`) and cash flow (an itemized fetch, bucketed client-side), but summary/wallet-usage/top-spending moved to their own dedicated endpoints (see "Report domain" below) once composing them from here meant too many round trips.
- Routes: `/api/transactions/{"", ":idTransaction"}` (`src/routes/transaction.routes.ts`) — no reorder endpoint, so no static-vs-dynamic route ordering concern here.
- All transaction routes require `requireAuth` + `requireActiveUser` — no `requireAdmin`.

### Report domain (dedicated endpoints — replaces composing from `/transactions`)

`src/services/report.service.ts`/`report.controller.ts`/`report.routes.ts` cover every report widget except category breakdown (bundled into `/reports/summary`'s response) and export (generated entirely client-side). Each endpoint exists because composing it from `/transactions` client-side meant too many round trips (one call per wallet, one per month) or too much payload (the whole period's itemized transactions just to bucket them for a chart).

- `GET /reports/summary?dateFrom&dateTo&previousDateFrom&previousDateTo` (all four required) — `ReportService.getSummary` runs `computeSummary()` + `TransactionModel.countDocuments()` for **both** periods in one `Promise.all`, and computes `changePercent` server-side, returning `{ totalIncome, totalExpense, netCashFlow, transactionCount, categoryBreakdown }` in a single response. Reuses the exact same `computeSummary`/`buildDateFilter` that power `GET /transactions` (both now exported from `transaction.service.ts` specifically for this reuse) — there's no separate aggregation logic to keep in sync.
- `GET /reports/wallet-usage?dateFrom&dateTo` — one aggregation over every wallet at once (`$filter` each transaction's `[idWallet, idWalletFrom, idWalletTo]` down to non-null ids, `$unwind`, `$group` by wallet id) instead of a query per wallet, then joined against `WalletModel.find({ idUser })` for names/colors and zero-filtered/sorted the same way the old per-wallet-call version was.
- `GET /reports/top-spending?dateFrom&dateTo&limit` — `TransactionModel.find({ idUser, type: "expense", date }).sort({ amount: -1 }).limit(limit)`, then resolves category/subcategory names server-side (same `CategoryModel.find({ _id: { $in: ... } })` + `.subCategories.id()` pattern `computeSummary` already uses) instead of leaving that lookup to the frontend.
- `GET /reports/cash-flow?dateFrom&dateTo&locale` — `ReportService.getCashFlow` does a single `TransactionModel.find({ idUser, date })` for the period, then buckets in memory by hour/day/week/month via `buildReportBuckets()` (`src/utils/reportBuckets.ts`) — ported 1:1 from the frontend's former client-side bucketing algorithm (same granularity-by-span rule, same hour-block/week/month boundaries), just anchored in UTC (`Date.UTC`/`getUTC*`) instead of local-Date-constructor math so bucket boundaries tile exactly inside the same `[dateFrom, dateTo]` window `buildDateFilter()` already interprets as UTC. `locale` (default `"id"`) drives `Intl.DateTimeFormat(locale, { timeZone: "UTC", ... })` for the bucket labels — Node's bundled full-ICU `Intl` supports arbitrary locales natively, no extra dependency needed. Deliberately a `find()` + in-memory sum rather than a Mongo `$bucket` pipeline: the bucket boundaries are irregular (4-hour blocks, weeks clamped to the period end) and transaction volume per report period is modest, so this stays simple and provably matches the old client behavior instead of re-deriving the same logic as a aggregation pipeline.
- `GET /reports/monthly-trend?months&locale` — `ReportService.getMonthlyTrend` runs one `$group` aggregation keyed by `{ $year: "$date", $month: "$date", type }` (both UTC by default, matching `buildDateFilter`'s existing UTC month semantics) over the whole trend range, then maps every month in the window (`generateMonthRangeUtc()`) to `{ label, income, expense }` — **both** metrics per month in one call, not just whichever `metric` was requested, so the frontend can toggle its Pengeluaran/Pemasukan tab without refetching.
- Routes: `/api/reports/{summary, wallet-usage, top-spending, cash-flow, monthly-trend}` (`src/routes/report.routes.ts`) — all `requireAuth` + `requireActiveUser`, no `requireAdmin`, same as every other domain.

### Account domain (danger-zone reset)

- `DELETE /api/account/data` (`src/routes/account.routes.ts`, `requireAuth` + `requireActiveUser`, no `requireAdmin`) wipes every document owned by the calling user — backs the frontend Settings page's "Zona Berbahaya" / Reset Data button.
- `AccountService.resetData` (`src/services/account.service.ts`) runs one `mongoose.startSession()` + `session.withTransaction(...)` and issues `deleteMany({ idUser }, { session })` against `TransactionModel`, `InvestmentTransactionModel`, `WalletModel`, `CategoryModel`, and `InstrumentModel` — same session/ownership-scoping convention as every other domain's delete path. Transactions/investment-transactions are deleted before wallets/categories/instruments purely for readability (there are no side-effect deltas to compute here, unlike a single transaction delete — this wipes the wallet/category/instrument documents themselves, not just their counters).
- No `UserModel` document is touched — this clears a user's financial data, not their account/login.

### MongoDB index gotcha

**Renaming or removing a `unique` schema field does not drop its old index in MongoDB** — Mongoose only adds indexes for what's in the current schema, it never removes stale ones. If you rename a unique field, every future insert has that phantom field as `null`, and the leftover unique index rejects the second `null` with a confusing `E11000 duplicate key` error that has nothing to do with your actual data. `src/config/database.ts` calls `UserModel.syncIndexes()` once after connecting specifically to keep this self-healing — if you add more models later, give them the same treatment (or drop the index manually via a one-off script, same idea as fixing this the first time it happened here).

### Manual testing

`postman/tosm-fi-be.postman_collection.json` — import it and follow the flow described in its collection-level description (register → login as bootstrap admin → register a second user → find their `idUser` via get-list-user → accept-user → log in as the now-approved user).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

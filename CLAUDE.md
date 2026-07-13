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

Express + TypeScript + Mongoose (MongoDB) API. The **auth / user-approval domain** (register, login, logout, "who am I", admin approval of new users) and the **wallet domain** are implemented so far. `archive/` holds an earlier, unrelated iteration of this project (accounts/transactions domain) — it's dead code, not imported by `app.ts`, ignore it unless deliberately reviving that domain.

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
- `balance`/`transactionCount` are only ever mutated by the transaction domain (not implemented yet) — the wallet endpoints themselves never touch them except at creation (`balance` defaults from the create payload, `transactionCount` always starts at 0).
- Creating a wallet does **not** auto-mark it primary, even the first one for a user — the FE's `WalletFormModal` has an explicit "set as primary" action (`PATCH /wallets/:idWallet/primary`), matching the mock service's old behavior exactly.
- `PATCH /wallets/:idWallet/primary` unsets `isPrimary` on every other wallet for that user before setting it on the target, then returns the full list (not just the changed wallet) since two wallets' `isPrimary` flip at once.
- `PATCH /wallets/reorder` takes `orderedIds: string[]` and writes each wallet's `order` to its index in that array; `GET /wallets` always sorts by `order` ascending.
- Routes: `/api/wallets/{"", ":idWallet", ":idWallet/primary", "reorder"}` (`src/routes/wallet.routes.ts`) — `/reorder` is registered before the generic `/:idWallet` PATCH route, otherwise Express would match "reorder" as an `:idWallet` param.
- All wallet routes require `requireAuth` + `requireActiveUser` (any active user manages their own wallets) — no `requireAdmin`.

### MongoDB index gotcha

**Renaming or removing a `unique` schema field does not drop its old index in MongoDB** — Mongoose only adds indexes for what's in the current schema, it never removes stale ones. If you rename a unique field, every future insert has that phantom field as `null`, and the leftover unique index rejects the second `null` with a confusing `E11000 duplicate key` error that has nothing to do with your actual data. `src/config/database.ts` calls `UserModel.syncIndexes()` once after connecting specifically to keep this self-healing — if you add more models later, give them the same treatment (or drop the index manually via a one-off script, same idea as fixing this the first time it happened here).

### Manual testing

`postman/tosm-fi-be.postman_collection.json` — import it and follow the flow described in its collection-level description (register → login as bootstrap admin → register a second user → find their `idUser` via get-list-user → accept-user → log in as the now-approved user).

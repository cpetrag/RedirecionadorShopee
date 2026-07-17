# Generic Redirect + API v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aceitar qualquer URL https (landings), criar redirects via API key, e garantir que links da API apareçam no admin com cliques/stats consultáveis.

**Architecture:** Extrair `createRedirect` compartilhado; validar destino genérico (https + denylist); detectar Shopee só para auto-fill; nova rota `POST/GET /api/v1/redirects`; UI e interstitial neutros. Mesma tabela `links` → dashboard já lista tudo.

**Tech Stack:** Next.js 15 App Router, better-sqlite3, TypeScript

**Spec:** `docs/superpowers/specs/2026-07-17-generic-redirect-api-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/security.ts` | `isAllowedDestinationUrl`, `isShopeeUrl`, `isRedirectApiAuthorized` |
| `lib/create-redirect.ts` | Create/dedupe/resolve/title fallback |
| `app/api/v1/redirects/route.ts` | POST create |
| `app/api/v1/redirects/[slug]/route.ts` | GET stats |
| `app/api/links/route.ts` | Use shared create |
| `components/admin/LinksManager.tsx` | Generic labels; analyze only for Shopee |
| `lib/templates.ts` | Neutral interstitial |
| `.env.example` + `README.md` | Document API + title optional |

---

### Task 1: Security helpers

**Files:**
- Modify: `lib/security.ts`
- Modify: `.env.example`

- [x] **Step 1:** Add `isPrivateOrLocalHostname(host)`, `isAllowedDestinationUrl(url)`, keep `isAllowedShopeeUrl` as alias or replace call sites with `isShopeeUrl` = old allowlist check.
- [x] **Step 2:** Add `isRedirectApiAuthorized(request)` reading `Authorization: Bearer` vs `REDIRECT_API_KEY`.
- [x] **Step 3:** Document `REDIRECT_API_KEY` and clarify `ALLOWED_HOSTS` in `.env.example`.

---

### Task 2: Shared createRedirect

**Files:**
- Create: `lib/create-redirect.ts`
- Modify: `app/api/links/route.ts`

- [x] **Step 1:** Implement `createRedirect({ url, title?, slug?, sub_ids?, sub_id? })` returning `{ link, existing }` or `{ error, status }`.
- [x] **Step 2:** Title fallback: client → Shopee resolve → hostname.
- [x] **Step 3:** Refactor `POST /api/links` to call `createRedirect` (accept `url` or `shopee_url`).

---

### Task 3: API v1 routes

**Files:**
- Create: `app/api/v1/redirects/route.ts`
- Create: `app/api/v1/redirects/[slug]/route.ts`

- [x] **Step 1:** POST — Bearer auth, body `{ url, title?, slug? }`, response with `destination_url`, `redirect_url`, `clicks`, `existing`.
- [x] **Step 2:** GET by slug — same auth, include full click stats; 404 if missing.

---

### Task 4: Admin UI + interstitial + docs

**Files:**
- Modify: `components/admin/LinksManager.tsx`
- Modify: `lib/templates.ts`
- Modify: `README.md`

- [x] **Step 1:** Generic copy; skip/fail-soft analyze for non-Shopee; don't block submit on resolve failure for non-Shopee.
- [x] **Step 2:** Neutral “Abrindo…” / “Abrir link” in Android + iOS templates.
- [x] **Step 3:** README section for API v1 (create + get stats, title optional).

---

### Task 5: Manual verification

- [x] **Step 1:** `npm run build` passes.
- [ ] **Step 2:** Curl POST landing without title → hostname title; appears in GET `/api/links` (admin).
- [ ] **Step 3:** Curl GET `/api/v1/redirects/:slug` returns clicks.
- [ ] **Step 4:** Private IP / missing key → 400 / 401.

# API testing — Discovery Engine

Both apps are tested against one self-cleaning suite:
- **Data Injector** = `injector/` API (default `http://localhost:8081`)
- **User App** = `app/` API (default `http://localhost:8080`)

## The collection
`discovery-engine-tests.postman_collection.json` — an ordered, self-cleaning suite:
1. **Reads & Connectivity** — health + critical GETs (pillars, industries, generate-identity, intentions) for both apps.
2. **Injector Lifecycle** — preflight token check → create product + intention → link → get → tear down → verify ID reuse.
3. **User App Lead** — submit → get → delete.

Every record it creates is deleted, and the preflight aborts before creating anything if the token is missing/wrong.

> Maintain this collection in the **Postman UI** (import it once). CI runs the cloud copy; local Newman runs this repo file — re-export when you change tests to keep them in sync.

## One-time setup
1. Run [`db/reset_id_sequence.sql`](../db/reset_id_sequence.sql) once in the Supabase SQL editor (so deletes don't skip IDs).
2. Import `discovery-engine-tests.postman_collection.json` into Postman.
3. Set the variable `testToken` to your `TEST_API_TOKEN` (from `.env`).

## Run it — three ways
- **Postman UI (interactive):** select the collection → **Run**. Per-test results + history in the UI.
- **Local CLI (on-demand):** start the APIs, then `npm run test:api` from the repo root — runs the same collection with Newman against localhost, reading `TEST_API_TOKEN` from `injector/.env`:
  ```
  npm --prefix injector run dev:api
  npm --prefix app run dev:api
  npm run test:api
  ```
- **CI (deployed):** [`.github/workflows/api-tests.yml`](../.github/workflows/api-tests.yml) runs the collection via the **Postman CLI** against the deployed apps on push to `preview`/`main`; results show up in Postman's run history.

## Local pre-push gate (blocks broken code from GitHub)
`.githooks/pre-push` runs **lint + typecheck + build** for both apps before every push and **aborts the push if anything fails** — fast, no servers/DB. Activate once (already set in this repo):
```
git config core.hooksPath .githooks
```
The full API tests aren't in the hook (they need running servers + the DB) — run those with `npm run test:api`.

## CI setup (for the deployed tests)
1. Add `TEST_API_TOKEN` to **both Vercel projects** (Preview + Production).
2. Add **`POSTMAN_API_KEY`** as a GitHub **repository secret**.
3. Create GitHub **Environments** `preview` + `production`, each with variables `USERAPP_URL` + `INJECTOR_URL` and secret `TEST_API_TOKEN`.

## Notes
- DELETE/destructive routes require the `x-test-token` header; a missing/wrong token returns 403 and the preflight aborts before any data is created.
- "No skipped IDs" only holds when deleting the most-recent (top) row.

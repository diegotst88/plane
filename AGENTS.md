# Agent Development Guide

## Commands

- `pnpm dev` - Start all dev servers (web:3000, admin:3001)
- `pnpm build` - Build all packages and apps
- `pnpm check` - Run all checks (format, lint, types)
- `pnpm check:lint` - OxLint across all packages
- `pnpm check:types` - TypeScript type checking
- `pnpm fix` - Auto-fix format and lint issues
- `pnpm turbo run <command> --filter=<package>` - Target specific package/app
- `pnpm --filter=@plane/ui storybook` - Start Storybook on port 6006

## Code Style

- **Imports**: Use `workspace:*` for internal packages, `catalog:` for external deps
- **TypeScript**: Strict mode enabled, all files must be typed
- **Formatting**: oxfmt, run `pnpm fix:format`
- **Linting**: OxLint with shared `.oxlintrc.json` config
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Error Handling**: Use try-catch with proper error types, log errors appropriately
- **State Management**: MobX stores in `packages/shared-state`, reactive patterns
- **Testing**: All features require unit tests, use existing test framework per package
- **Components**: Build in `@plane/ui` with Storybook for isolated development

## Backend tests (Docker)

The Django/pytest suite for `apps/api` runs in an isolated stack defined by `docker-compose-test.yml` at the repo root.

Prereq (once): `./setup.sh` — generates `apps/api/.env` from `.env.example`.

- Full suite: `docker compose -f docker-compose-test.yml up --build --abort-on-container-exit --exit-code-from api-tests`
- Subset: `docker compose -f docker-compose-test.yml run --rm api-tests pytest -m unit`
- Teardown: `docker compose -f docker-compose-test.yml down -v`

See `apps/api/tests/RUNNING_TESTS.md` for the full walkthrough and troubleshooting; see `apps/api/tests/TESTING_GUIDE.md` for test conventions and fixtures.

## Cursor Cloud specific instructions

- `package.json` requires Node `>=22.18`. Login shells can resolve `/exec-daemon/node` (v22.14) first. Cloud install and start prepend `/home/ubuntu/.nvm/versions/node/v22.23.3/bin`.
- Canonical local setup is `./setup.sh`, then `docker compose -f docker-compose-local.yml up`, then `pnpm dev`. Web is port 3000, admin/god-mode is port 3001, space is 3002, live is 3100, and the API is 8000.
- Open the apps at `http://localhost:3000` and `http://localhost:3001/god-mode/`. The API CORS list matches those `localhost` origins.
- The first god-mode visit registers the instance admin. Sign in to the web app with that same account, then create a workspace.
- This VM has no systemd. Start `containerd` and `dockerd` directly, with `fuse-overlayfs` as the storage driver. After the daemon is up, set `net.bridge.bridge-nf-call-iptables=0` and `net.bridge.bridge-nf-call-ip6tables=0` so containers on the same bridge can reach Postgres.
- `minio/minio` is no longer published on Docker Hub. Pull `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` and tag it `minio/minio:latest` before Compose starts `plane-minio`.

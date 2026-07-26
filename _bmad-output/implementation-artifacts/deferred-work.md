# Deferred Work

## Deferred from: code review of 1-2-xac-thuc-application-shell-va-ci-boundaries (2026-07-26)

- No ETag/Last-Modified/304 or Range support in the static pipeline — `index.html` `no-cache` has nothing to revalidate against, so every navigation refetches the full document. Optimization beyond MVP SLO; revisit if redirect/dashboard benchmarks surface static-serving overhead.
- Hardcoded ports 3196–3199 in `tests/api-process.test.ts` can flake under parallel vitest runs, and standalone runs depend on a prior `build:all`. Pre-existing suite pattern from Story 1.1; fix by parsing an ephemeral port from child output if flakes appear.
- Static/SPA traffic is unlogged (`RequestLoggerMiddleware` scoped to health) — no visibility on asset 404s, fallback serves, or traversal attempts. Belongs to the AD-16 observability story; be careful not to log future short-path values at noisy levels.
- Content-Length race when `index.html` is rewritten between `stat` and streaming during deploys — truncated response possible in the redeploy window. Render restarts the process on deploy, so exposure is minimal; revisit with zero-downtime deploy work.

## Deferred from: code review of 1-1-khoi-tao-secure-application-shell (2026-07-26)

- drizzle-kit 0.31.10 drags deprecated `@esbuild-kit/*` packages and three distinct esbuild versions (0.18.20 / 0.25.12 / 0.28.1, ~70 platform artifacts) into the dependency tree. Upstream chain — not actionable locally; re-check when bumping drizzle-kit.
- `npm ci --omit=dev` still installs the full vite/vitest/drizzle-kit/tsx/esbuild/rolldown/lightningcss toolchain because better-auth declares them as optional peers, flagging 56 lock entries `devOptional` instead of `dev`. Production installs would ship hundreds of MB of build tooling. Revisit when a production deploy pipeline (Docker/omit-dev install) is defined — likely needs `--omit=dev --omit=optional` or upstream fix.
- `npm ci --omit=optional` installs cleanly but strips the esbuild/rolldown/lightningcss native platform binaries (all distributed as `optional: true` with no fallback), so `vite build`/`vitest` fail later with missing-native-binding errors. No guard exists in `tests/verify-toolchain.js`. Install mode currently unused by repo or CI; add a guard if that changes.

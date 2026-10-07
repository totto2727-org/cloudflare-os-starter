# Upstream differences

## Comparison baseline

This deployment fork is compared with [`cloudflare/cloudflare-os-starter` at `3d211477ad009e13a98d863d843e5c12a29ad02b`](https://github.com/cloudflare/cloudflare-os-starter/tree/3d211477ad009e13a98d863d843e5c12a29ad02b).
The upstream runtime source is unchanged: the `cloudflare-os` submodule remains pinned to [`6478a1448a11524e2f7c2575ad66fab0bc47c433`](https://github.com/cloudflare/cloudflare-os/tree/6478a1448a11524e2f7c2575ad66fab0bc47c433).
The deployment wrapper, custom Gatekeeper, Error Reporter, and deployment configuration present at the comparison baseline are upstream starter features, not additional source-fork customizations.

## Starter toolchain

- **Purpose:** adopt stable Vite Plus 1 in the deployment starter without changing the pinned runtime's decorator transforms or Worker test integration.
- **Affected areas:** the workspace catalog and lockfile, root package scripts, owned package task configs, deployment build commands and their regression tests, and this documentation linked from the README.
- **Difference:** the starter uses the flexible `vite-plus: ^1.1.0` range instead of upstream's `^0.2.8`.
- **Operational impact:** `vp lint` uses the updated linter, while root `pnpm build` and `pnpm test` use uncached pnpm orchestration of the same TypeScript compiler and standalone Vitest suites.
Vite Plus 1 requires task `input` and `output` fields under `cache`, but the pinned runtime's shared test task still uses the legacy schema.
Vite Plus loads every workspace package config, so filtering to owned packages does not bypass that incompatibility.
Owned package task definitions use the new schema in preparation for a later upstream pin upgrade, but the starter cannot currently use `vp run` to execute them.
The deployment script invokes `tsc` directly for the owned custom Gatekeeper and Error Reporter, preserving the requirement that deployment builds never replay cached artifacts.
Submodule deployment builds still use their separate upstream Vite Plus version with `--no-cache`, as before.
The upstream runtime workspace still installs its own pinned toolchain separately, as described in the README.

All other shared catalog entries retain the upstream values, including exact Vite `7.3.6`, TypeScript `7.0.2`, and `capnweb-validate` `0.2.4`.
Vite 7 is deliberate: the pinned runtime depends on esbuild's Stage-3 decorator lowering for `@validateRpc()`, rather than the newer Oxc transform.
The starter narrows its Vite override to standalone Vitest 4 and `@vitest/mocker` 4 so that Vite Plus 1's private Vite core and bundled Vitest 5 are not replaced with Vite 7.
A scoped `@vitest/browser-preview` override likewise prevents Vite Plus's optional browser-preview 5 dependency from satisfying the standalone package tests' Vitest 4 peer.
The redundant root Worker pool dependency is removed, leaving it in the custom Gatekeeper package that actually owns Worker tests.
`pnpm peers check` still reports Vite Plus's private Vite alias version (`1.1.0` rather than its underlying Vite 8 version) against bundled Vitest 5's Vite peer, plus an unused optional `@vitest/ui` 5 peer against Vitest 4.
The supported checks are non-UI standalone Vitest 4 suites and Vite Plus lint, not Vitest UI or Vite Plus's bundled Worker test runner.
The starter does not exempt the Vite Plus 1.1.0 toolchain from the package manager's default release-age policy.
Fresh resolution and lockfile policy verification must wait until those releases meet the configured age threshold, without lowering that threshold or changing dependency ranges.

Worker tests continue to use the standalone catalog `vitest: ^4.1.10` and `@cloudflare/vitest-pool-workers: ^0.20.2`, never `vp test` or `vite-plus/test`.
Even the newer Worker pool `0.22.0` [declares Vitest, runner, and snapshot peers of `^4.1.0`](https://registry.npmjs.org/@cloudflare/vitest-pool-workers/0.22.0), whereas [Vite Plus `1.1.0` bundles Vitest `5.0.3`](https://registry.npmjs.org/vite-plus/1.1.0).
Updating the pool alone would therefore not make Vite Plus's bundled test runner compatible.
Keep the runtime and test catalog values aligned with the submodule when upgrading its gitlink, and treat the starter's Vite Plus entry and scoped overrides as documented exceptions.

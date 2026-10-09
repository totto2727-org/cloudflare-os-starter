# Fork differences from upstream

This is the maintained summary of intentional differences between [`totto2727-org/cloudflare-os-starter`](https://github.com/totto2727-org/cloudflare-os-starter) and the official [`cloudflare/cloudflare-os-starter`](https://github.com/cloudflare/cloudflare-os-starter).
It describes this starter fork only, not another Cloudflare OS checkout or another fork in the surrounding workspace.
Deployment instructions for this configured environment are in [DEPLOYMENT.ja.md](../DEPLOYMENT.ja.md).

## Immutable comparison

| Component | Snapshot |
| --- | --- |
| Official starter baseline | [`3d211477ad009e13a98d863d843e5c12a29ad02b`](https://github.com/cloudflare/cloudflare-os-starter/commit/3d211477ad009e13a98d863d843e5c12a29ad02b) |
| Reviewed fork snapshot | [`a4a247102f215aa1021730ef8d90e907538f31ec`](https://github.com/totto2727-org/cloudflare-os-starter/commit/a4a247102f215aa1021730ef8d90e907538f31ec) |
| Cloudflare OS runtime gitlink in both snapshots | [`6478a1448a11524e2f7c2575ad66fab0bc47c433`](https://github.com/cloudflare/cloudflare-os/commit/6478a1448a11524e2f7c2575ad66fab0bc47c433) |

The summary below compares the two starter trees directly, not a moving `main` branch or a merge-base-only diff.
The comparison contains all four changed paths, including documentation:

| Status | Path | Difference and purpose |
| --- | --- | --- |
| Added | `DEPLOYMENT.ja.md` | Documents this configured environment and the existing operator-run deployment workflow. |
| Modified | `README.md` | Adds a discovery link to this fork's divergence record without changing the official deployment instructions. |
| Modified | `deployment.jsonc` | Selects the owner's deployment account, services, hostname, Access configuration, AI Gateway, existing storage, and integration display text. |
| Added | `docs/upstream-differences.md` | Records this repository's upstream baseline, complete differences, operational implications, and maintenance rules. |

The reviewed snapshot already contains the README link and this record.
Later documentation-only revisions, including corrections to this record, remain part of the complete fork difference and must not be excluded from the inventory.

Reproduce the comparison locally when both commits are available:

```sh
git diff --name-status 3d211477ad009e13a98d863d843e5c12a29ad02b a4a247102f215aa1021730ef8d90e907538f31ec
git diff 3d211477ad009e13a98d863d843e5c12a29ad02b a4a247102f215aa1021730ef8d90e907538f31ec
git ls-tree 3d211477ad009e13a98d863d843e5c12a29ad02b cloudflare-os
git ls-tree a4a247102f215aa1021730ef8d90e907538f31ec cloudflare-os
```

For a later revision, compare the same baseline with `HEAD` to include every committed path, including this record, without embedding the record's own commit SHA:

```sh
git diff --name-status 3d211477ad009e13a98d863d843e5c12a29ad02b HEAD
git diff 3d211477ad009e13a98d863d843e5c12a29ad02b HEAD
```

During pre-commit review, omit `HEAD` from those two commands to include tracked working-tree changes as well, and inspect `git status --short` for newly added untracked paths.

## Intentional deployment differences

The configuration changes specialize the official starter for the owner's existing environment without changing its deployment implementation.
Values and provenance comments are kept in [deployment.jsonc](../deployment.jsonc), rather than duplicating account identifiers, administrator addresses, or Access audience values here.

| Configuration | Difference from the official baseline | Reason and effect |
| --- | --- | --- |
| `accountId` | Replaces the required account placeholder with the confirmed deployment account and records its provenance. | Targets that account for every generated Worker configuration. |
| `workers.*.name` | Replaces six placeholders with `cloudflare-os-router`, `cloudflare-os-workshop`, `cloudflare-os-context`, `cloudflare-os-scheduler`, `cloudflare-os-custom-gatekeeper`, and `cloudflare-os-error-reporter`. | Gives the six existing starter roles explicit service identities used by deployment and service bindings. |
| `workers.router.route.customDomain` | Changes `os.example.com` to `cloudflare.totto2727.dev`. | Selects the intended public hostname, with `publicBaseUrl` still `null` so the script derives `https://cloudflare.totto2727.dev`. |
| `access.issuer`, `access.audience`, `access.admins` | Replaces placeholders with the confirmed Access team origin, this application's AUD, and the administrator email list, with provenance comments. | Configures the existing Access-mode trust checks and `/admin` allowlist, without switching sign-in methods or creating an Access application or policy. |
| `aiGateway.name`, `aiGateway.accountId` | Changes `default` to `iac-prod-ai-gateway` and replaces account inheritance through `null` with the explicit, identical deployment account. | Selects the gateway described as infra-managed by the recorded provenance, while keeping same-account binding transport. |
| `context.kvNamespaceId`, `resources.*` | Replaces four `null` storage selectors with explicit existing KV IDs and an R2 bucket name. | Reuses the recorded storage resources instead of leaving their selection to automatic provisioning. |
| `customGatekeeper.name`, `customGatekeeper.message` | Replaces organization placeholders with `totto2727` and deployment guidance pointing to the public URL. | Personalizes the existing example integration's display text, not its code or capabilities. |

The AI model catalog remains enabled with `providers: ["cloudflare"]`, as in the official baseline.
The unchanged `aiGatewayPlan` implementation resolves the explicit gateway account to the same account and does not require an AI Gateway API token for this provider selection.
Selecting the named gateway does not provision it, verify its availability, or establish that inference is free.
Access policies still control admission separately from the application's administrator list.

### Stored resource identities versus generated configuration

| Tracked selector | Resource selected by the fork |
| --- | --- |
| `context.kvNamespaceId` | KV namespace recorded as `cloudflare-os-context-context-collections` |
| `resources.blueprintsKvNamespaceId` | KV namespace recorded as `cloudflare-os-workshop-blueprints` |
| `resources.avatarsKvNamespaceId` | KV namespace recorded as `cloudflare-os-workshop-avatars` |
| `resources.blueprintContentBucket` | R2 bucket `cloudflare-os-workshop-blueprint-content` |

The KV names are provenance labels in configuration comments and the deployment guide, while the actual KV bindings use the stored IDs.
The R2 binding uses the stored bucket name directly.
The existing deployment script inserts these selectors into generated `wrangler.prod.jsonc` files and removes those files in its `finally` cleanup.
Removing a generated local configuration file is not a deletion of its remote KV namespace or R2 bucket.
The durable record of this fork's explicit resource selection is the tracked `deployment.jsonc`, not a generated file.

The official [storage guidance](https://github.com/cloudflare/cloudflare-os-starter/blob/3d211477ad009e13a98d863d843e5c12a29ad02b/docs/customization.md#storage) already supports both automatic provisioning and explicit existing-resource bindings.
This fork changes the selectors, not that capability.
Do not reset the selectors to `null` merely to regenerate configuration or rename Workers casually when preserving deployment data.
Worker names are service identities, and the unchanged deployment implementation also documents Scheduler Durable Objects as belonging to that Worker's script identity.
`context.sharingDomain` remains `null`, so the public origin is still the Context isolation boundary and changing the hostname can hide existing collections even with the same KV binding.

## Added deployment guide

[DEPLOYMENT.ja.md](../DEPLOYMENT.ja.md) adds Japanese instructions for this configured environment, including dependency preparation, Access checks, configuration provenance, storage reuse, operator-run validation and deployment, and post-deployment checks.
It documents `vp install`, `vp -C cloudflare-os install`, and `vp exec wrangler login`, followed by `vp exec node --run check` and `vp exec node --run deploy`.
These entry points use VP execution and Node.js package scripts without loading the task graph, because Vite Plus 1's `vp run` cannot load the pinned runtime's legacy cache schema.
The guide itself adds no deployment logic or runtime features.
The guide's statements about previously confirmed resource existence are recorded provenance, not a fresh remote verification by this comparison.

## What has not changed

- The `cloudflare-os` submodule gitlink is identical in both starter snapshots.
- [`.gitmodules`](https://github.com/cloudflare/cloudflare-os-starter/blob/3d211477ad009e13a98d863d843e5c12a29ad02b/.gitmodules) still points to `https://github.com/cloudflare/cloudflare-os.git`, not a user-owned runtime fork.
- The runtime source pinned by that gitlink is therefore unchanged in this comparison.
- `scripts/`, `packages/`, `package.json`, dependency manifests and lockfile, and the existing official documentation other than the README discovery link are unchanged in the compared snapshots.
- The six-Worker architecture, router-owned public route, private service bindings, Access-mode frontend build, AI Gateway binding transport, storage binding support, validation, dry-run, deployment order, and generated-file cleanup already belong to the official starter.

The authoritative implementation for those existing behaviors is the official [`scripts/deploy.ts`](https://github.com/cloudflare/cloudflare-os-starter/blob/3d211477ad009e13a98d863d843e5c12a29ad02b/scripts/deploy.ts), alongside the official [`README.md`](https://github.com/cloudflare/cloudflare-os-starter/blob/3d211477ad009e13a98d863d843e5c12a29ad02b/README.md) and [`docs/customization.md`](https://github.com/cloudflare/cloudflare-os-starter/blob/3d211477ad009e13a98d863d843e5c12a29ad02b/docs/customization.md).
Do not describe them as custom implementation work in this fork unless a later source comparison actually shows such a change.
Repository configuration alone does not prove a successful deployment, correct external Access policies, current resource ownership, gateway availability, or runtime behavior.

## Maintenance rule for this fork

Update this document whenever a change in this starter fork introduces, alters, or removes a difference from its reviewed upstream baseline.
Keep that update with the corresponding change, and keep the README link discoverable.
This rule covers source and scripts, deployment configuration, documentation, dependency changes, and submodule URL or gitlink changes within this repository only.

For each update:

1. Identify the exact official starter baseline and a committed complete fork snapshot, using full immutable SHAs and source links rather than branch names alone.
2. Compare the complete starter trees and inspect every changed path before revising the summary.
3. Describe each retained difference, why it exists, its observable effect, and any storage, trust, compatibility, or operational consequence.
4. Distinguish inherited upstream behavior from fork additions, and record removed or upstreamed differences rather than continuing to claim them as customizations.
5. Compare both the runtime gitlink and `.gitmodules` separately, updating runtime provenance only when the actual pin or source URL changes.
6. Preserve intentional environment and storage selections during upstream synchronization, and follow the official [upgrade checklist](customization.md#upgrade) for a runtime pin change.
7. Include documentation-only additions and revisions, including this record and its README link, in the complete path inventory; distinguish the immutable reviewed snapshot from later `HEAD` or working-tree changes without requiring a self-referential commit SHA.

Keep this file as maintained fork documentation, not a task log, deployment success report, or ToDo ledger.
Never include API tokens, signing secrets, cookies, or other credential values.

## Consolidated toolchain differences

The comparison inventory above describes the deployment-only snapshot.
The current fork also includes the toolchain changes below, imported from `totto2727-org/cloudflare-os-starter-1` at [`c554be66acce6dd9def895ceecc8e39eef44f0d5`](https://github.com/totto2727-org/cloudflare-os-starter/commit/c554be66acce6dd9def895ceecc8e39eef44f0d5).
The existing `deployment.jsonc` and runtime gitlink are preserved.
The additional changed paths are `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `packages/custom-gatekeeper/package.json`, `packages/custom-gatekeeper/vite.config.ts`, `packages/error-reporter/vite.config.ts`, `vite.config.ts`, `scripts/deploy.ts`, `scripts/deploy.test.ts`, and `scripts/deployment-config.ts`.
The compatible dependency range changes below are imported from [`ec17eb7b53f750f54678e8d56c32a9737d1919ec`](https://github.com/totto2727-org/cloudflare-os-starter/commit/ec17eb7b53f750f54678e8d56c32a9737d1919ec) of the same tooling fork.
The consolidated starter removes all dependency overrides and uses normal dependency and peer resolution, rather than retaining tooling-fork override exceptions.
The README, Japanese deployment guide, and this record also reflect the combined workflow.
Statements above about unchanged scripts and manifests apply only to the earlier deployment-only snapshot, not the current toolchain.

## Starter toolchain

- **Purpose:** adopt stable Vite Plus 1 in the deployment starter without changing the pinned runtime's decorator transforms or Worker test integration.
- **Affected areas:** the workspace catalog and lockfile, root package scripts, owned package task configs, deployment build commands and their regression tests, and this documentation linked from the README.
- **Difference:** the starter uses the flexible `vite-plus: ^1.0.0` range instead of upstream's `^0.2.8`, with the lockfile resolving the mature `1.0.0` release.
- **Operational impact:** root entry points are `vp exec node --run test`, `vp exec node --run lint`, and `vp exec node --run build`, with the same pattern for `check` and `deploy`.
Root scripts use `vp exec` filters and Node.js 24 package-script execution, not pnpm orchestration, to run the TypeScript compiler and standalone Vitest suites without task caching.
The lint script runs Vite Plus lint and the deploy-tooling and package type checks.
Vite Plus 1 requires task `input` and `output` fields under `cache`, but the pinned runtime's shared test task still uses the legacy schema.
`vp run` loads every workspace package config, so filtering its task graph to owned packages does not bypass that incompatibility.
Owned package task definitions use the new schema in preparation for a later upstream pin upgrade, but the starter cannot currently use `vp run` to execute them.
The deployment script invokes `tsc` through VP execution for the owned custom Gatekeeper and Error Reporter, preserving the requirement that deployment builds never replay cached artifacts.
It launches the explicit workspace-local `node_modules/vite-plus/bin/vp` entry with `process.execPath`, rather than using pnpm transport or relying on a globally selected VP binary.
The starter selects Vite Plus `1.0.0`, while runtime build commands select the pinned runtime's separate Vite Plus `0.2` toolchain by setting `BuildCommand.cwd` to `"cloudflare-os"` and retain `--no-cache`.
The upstream runtime workspace still installs its own pinned toolchain separately, as described in the README.

Other shared catalog entries retain their existing concrete lockfile resolutions, including Vite `7.3.6`, TypeScript `7.0.2`, and `capnweb-validate` `0.2.4`, while their declarations use compatible caret ranges as described below.
Vite 7 is deliberate: the pinned runtime depends on esbuild's Stage-3 decorator lowering for `@validateRpc()`, rather than the newer Oxc transform.
The starter has no dependency overrides: standalone Vitest 4, its peers, and Vite Plus 1's private Vite core and bundled Vitest 5 use normal dependency resolution.
The redundant root Worker pool dependency is removed, leaving it in the custom Gatekeeper package that actually owns Worker tests.
The supported checks are non-UI standalone Vitest 4 suites and Vite Plus lint, not Vitest UI or Vite Plus's bundled Worker test runner.
Dependency installation, root tests, and lint do not establish that the full `check` command's Wrangler dry-run or a production deployment succeeds.
The starter retains the package manager's default minimum release age without toolchain exclusions or threshold changes.
Vite Plus `1.0.0` and its private core and native toolchain packages are mature enough for fresh frozen installs under that policy now.
The flexible range permits later compatible releases only when they meet the same age policy, rather than bypassing it for the freshly published `1.1.0` release.

Worker tests continue to use the standalone catalog `vitest: ^4.1.10` and `@cloudflare/vitest-pool-workers: ^0.20.2`, never `vp test` or `vite-plus/test`.
Even the newer Worker pool `0.22.0` [declares Vitest, runner, and snapshot peers of `^4.1.0`](https://registry.npmjs.org/@cloudflare/vitest-pool-workers/0.22.0), whereas [Vite Plus `1.0.0` bundles Vitest `5.0.1`](https://registry.npmjs.org/vite-plus/1.0.0).
Updating the pool alone would therefore not make Vite Plus's bundled test runner compatible.
Keep the shared runtime and test resolved versions aligned with the submodule when upgrading its gitlink, and treat the starter's newer Vite Plus entry as the documented toolchain exception.
The starter no longer uses the inherited `pnpmCommand` transport, and its deployment, test, and secret instructions use VP.
This transport change is limited to the starter's orchestration: the pinned runtime source remains unchanged.

## Gitignore-based lint exclusions

- **Purpose:** keep the starter's lint exclusions synchronized with reachable `.gitignore` files.
- **Affected areas:** `vite.config.ts`, `.npmrc`, the root development dependencies, the lockfile, and this record.
- **Difference:** `@totto2727/gitignore-patterns` generates root-relative exclusion patterns when the starter configuration loads, instead of separate `dist`, `node_modules`, and `.wrangler` glob lists.
- **Operational impact:** `.npmrc` selects the public JSR npm-compatible registry for the package alias, and frozen installs use the recorded package version and integrity.

The configuration retains the separate exclusions for the upstream submodule, generated source directories, `*.gen.ts`, and `worker-configuration.d.ts` because they are not fully covered by the starter's Gitignore rules.
The generator takes a snapshot of existing ignored paths on each configuration load.
Only paths covered by reachable Gitignore rules receive these generated exclusions.
A `dist` or `.wrangler` directory outside those rules no longer receives a separate global exclusion.
Vite Plus also applies its native Gitignore exclusions.
The runtime submodule source, its toolchain configuration, and the gitlink are unchanged.

## Compatible dependency ranges

- **Purpose:** allow compatible dependency releases instead of exact npm requirements in the deployment starter.
- **Affected areas:** the root and custom Gatekeeper manifests, shared workspace catalog, removal of dependency overrides, and lockfile requirement metadata.
- **Difference:** `capnweb-validate`, `typescript`, `vite`, and `@types/node` requirements use caret ranges, without Vite or browser-preview peer-resolution overrides.
- **Operational impact:** frozen installs through `vp install` use the committed lockfile, while later dependency updates can select compatible releases under the underlying package manager's unchanged default minimum release age.

The shared Vite catalog remains on `^7.3.6` to preserve the esbuild Stage-3 decorator lowering that `@validateRpc()` requires.
Normal peer resolution, not overrides, governs the standalone test graph.
The TypeScript range remains on TypeScript 7 because the upstream shared configuration uses `singleThreaded`.
The starter and upstream runtime install separately, so review shared resolved versions in both lockfiles when updating dependencies to prevent incompatible RPC stub copies.
Range declarations need not be byte-identical to the upstream catalog, but shared runtime resolutions must remain aligned.
The upstream runtime's own dependency declarations and lockfile are unchanged by these starter dependency changes.
Package manager versions, the upstream gitlink, CI action identities, and concrete lockfile resolutions remain reproducibility boundaries rather than dependency range constraints.

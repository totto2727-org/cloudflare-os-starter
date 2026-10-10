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
It presents the existing workflow through `vp`, including `vp install`, `vp -C cloudflare-os install`, `vp run check`, and `vp run deploy`.
These are documentation additions, not newly implemented package scripts, deployment logic, or runtime features.
The workspace checkout is located at `fork/app/cloudflare-os-starter/`.
The guide's working-directory command follows that placement without changing the upstream toolchain or runtime.
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

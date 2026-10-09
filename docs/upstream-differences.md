# Upstream differences

## Comparison baseline

This deployment fork is compared with [`cloudflare/cloudflare-os-starter` at `3d211477ad009e13a98d863d843e5c12a29ad02b`](https://github.com/cloudflare/cloudflare-os-starter/tree/3d211477ad009e13a98d863d843e5c12a29ad02b).
The upstream runtime source is unchanged: the `cloudflare-os` submodule remains pinned to [`6478a1448a11524e2f7c2575ad66fab0bc47c433`](https://github.com/cloudflare/cloudflare-os/tree/6478a1448a11524e2f7c2575ad66fab0bc47c433).
The deployment wrapper, custom Gatekeeper, Error Reporter, and deployment configuration at this baseline are upstream starter features, not additional source-fork customizations.

## Compatible dependency ranges

- **Purpose:** allow compatible dependency releases instead of exact npm requirements in the deployment starter.
- **Affected areas:** the root and custom Gatekeeper manifests, shared workspace catalog, dependency overrides, and lockfile requirement metadata.
- **Difference:** `capnweb-validate`, `typescript`, `vite`, and `@types/node` requirements use caret ranges, including peer-resolution overrides.
- **Operational impact:** frozen installs retain the existing concrete versions and integrity hashes, while later dependency updates can select compatible releases under pnpm's unchanged default minimum release age.

The Vite override still constrains transforms to Vite 7, preserving the esbuild Stage-3 decorator lowering that `@validateRpc()` requires.
The TypeScript range remains on TypeScript 7 because the upstream shared configuration uses `singleThreaded`.
The starter and upstream runtime install separately, so review shared resolved versions in both lockfiles when updating dependencies to prevent incompatible RPC stub copies.
Range declarations need not be byte-identical to the upstream catalog, but shared runtime resolutions must remain aligned.
The upstream runtime's own dependency declarations and lockfile are unchanged in this deployment-only change.
Package manager versions, the upstream gitlink, CI action identities, and concrete lockfile resolutions remain reproducibility boundaries rather than dependency range constraints.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "jsonc-parser";
import type { ParseError } from "jsonc-parser";
import { aiGatewayPlan, buildCommands, generateConfigs, validateConfig } from "./deploy.ts";
import type {
  BaseConfigs,
  DeploymentConfig,
  GeneratedConfigs,
  ProdWranglerConfig,
} from "./deployment-config.ts";

const present = <T>(value: T | null | undefined): T => {
  assert.ok(
    value !== null && value !== undefined,
    "Expected the generated configuration value to exist",
  );
  return value;
};

const validConfig: DeploymentConfig = {
  access: {
    admins: ["admin@example.com"],
    audience: "access-audience",
    issuer: "https://acme.cloudflareaccess.com",
  },
  accountId: "0123456789abcdef0123456789abcdef",
  aiGateway: {
    accountId: null,
    enabled: true,
    name: "cloudflare-os",
    providers: ["anthropic", "cloudflare"],
  },
  context: {
    artifacts: { enabled: true, namespace: "acme-context-collections" },
    kvNamespaceId: "context-kv-id",
    sharingDomain: null,
  },
  customGatekeeper: { message: "Use the company handbook.", name: "Acme" },
  errorReporting: { enabled: true, environment: "production", release: "abc123" },
  observability: {
    enabled: true,
    headSamplingRate: 0.5,
    logs: { invocationLogs: false },
    traces: { enabled: true, headSamplingRate: 0.25 },
  },
  publicBaseUrl: null,
  resources: {
    avatarsKvNamespaceId: "avatars-kv-id",
    blueprintContentBucket: "cloudflare-os-blueprints",
    blueprintsKvNamespaceId: "blueprints-kv-id",
  },
  workers: {
    context: { name: "acme-cloudflare-os-context" },
    customGatekeeper: { name: "acme-cloudflare-os-custom" },
    errorReporter: { name: "acme-cloudflare-os-errors" },
    router: { name: "acme-cloudflare-os", route: { customDomain: "os.example.com" } },
    scheduler: { name: "acme-cloudflare-os-scheduler" },
    workshop: { name: "acme-cloudflare-os-backend" },
  },
};

/**
 * A copy of {@link validConfig} with `mutate` applied, typed loosely on purpose.
 *
 * Most of these variants assign something `DeploymentConfig` forbids, which is exactly what
 * `validateConfig` exists to catch: `deployment.jsonc` is hand-edited JSONC with no schema behind
 * it, so the type describes the valid shape rather than guaranteeing what is on disk.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- These tests mutate arbitrary invalid input to exercise runtime validation.
const variant = (mutate: (config: Record<string, any>) => void): DeploymentConfig => {
  const config = structuredClone(validConfig) as unknown as Parameters<typeof mutate>[0];
  mutate(config);
  return config as DeploymentConfig;
};

// Parsed the way `deploy.ts` parses it, errors included. Swallowing them would let a base config
// that the deploy cannot read still pass these tests on a best-effort parse -- which is how the
// Scheduler's trailing commas hid: nine parse errors, and a config object that still looked usable.
const baseConfig = async (path: string): Promise<ProdWranglerConfig> => {
  const errors: ParseError[] = [];
  const result = parse(await readFile(new URL(path, import.meta.url), "utf-8"), errors, {
    allowTrailingComma: true,
  }) as ProdWranglerConfig;
  assert.deepEqual(errors, [], `${path} did not parse cleanly`);
  return result;
};

// Read from disk rather than inlined, including the Error Reporter's: deploy.ts derives every
// generated config from these files, so a copy here could drift from what actually ships.
const baseConfigs = async (): Promise<BaseConfigs> => ({
  context: await baseConfig("../cloudflare-os/packages/gatekeeper-context/wrangler.jsonc"),
  customGatekeeper: await baseConfig("../packages/custom-gatekeeper/wrangler.jsonc"),
  errorReporter: await baseConfig("../packages/error-reporter/wrangler.jsonc"),
  router: await baseConfig("../cloudflare-os/packages/router/wrangler.jsonc"),
  scheduler: await baseConfig("../cloudflare-os/packages/gatekeeper-scheduler/wrangler.jsonc"),
  workshop: await baseConfig("../cloudflare-os/packages/workshop-backend/wrangler.jsonc"),
});

/** The Context data-isolation boundary carried by the Workshop's Gatekeeper binding. */
const sharingDomain = (generated: GeneratedConfigs): unknown => {
  const service = present(generated.workshop.services).find(
    (item) => item.binding === "GATEKEEPER_CONTEXT",
  );
  return present(present(service).props).sharingDomain;
};

test("rejects deployment placeholders", () => {
  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.accountId = "<CLOUDFLARE_ACCOUNT_ID>";
        }),
      ),
    /placeholder/iu,
  );
});

test("rejects destructive or malformed deployment values", () => {
  const duplicateWorkers = structuredClone(validConfig);
  duplicateWorkers.workers.context.name = duplicateWorkers.workers.workshop.name;
  assert.throws(() => validateConfig(duplicateWorkers), /unique/iu);

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.observability.enabled = "true";
        }),
      ),
    /boolean/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.workers.router.route.customDomain = "os.example.com/path";
        }),
      ),
    /hostname/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.context.sharingDomain = "";
        }),
      ),
    /sharingDomain must be null or a non-empty string/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.access.issuer += "/team";
        }),
      ),
    /issuer.*origin/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.access.audience = "   ";
        }),
      ),
    /audience/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.access.audience = " access-audience ";
        }),
      ),
    /audience/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.access.admins = ["bad-address"];
        }),
      ),
    /email/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.observability.traces.headSamplingRate = 2;
        }),
      ),
    /sampling/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.context.artifacts.enabled = "true";
        }),
      ),
    /Artifacts enabled.*boolean/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.context.artifacts = null;
        }),
      ),
    /Artifacts configuration.*object/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.context.artifacts = [];
        }),
      ),
    /Artifacts configuration.*object/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.context.artifacts.namespace = null;
        }),
      ),
    /namespace must be omitted/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.context.artifacts.namespace = "context/collections";
        }),
      ),
    /namespace must be omitted/iu,
  );
});

test("rejects AI Gateway keys that no longer do anything", () => {
  // A silently-ignored workersAi block is how a deploy succeeds with an empty model picker.
  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.aiGateway.workersAi = { mode: "gateway" };
        }),
      ),
    /aiGateway\.workersAi does nothing/iu,
  );
  // Even with AI off: the key means the operator believes it still does something.
  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.aiGateway = { enabled: false, workersAi: { mode: "direct" } };
        }),
      ),
    /aiGateway\.workersAi does nothing/iu,
  );
});

test("rejects malformed AI Gateway providers and account", () => {
  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.aiGateway.providers = [];
        }),
      ),
    /Missing required deployment value: aiGateway.providers/u,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.aiGateway.providers = ["anthropic", "mistral"];
        }),
      ),
    /providers must be a non-empty subset/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.aiGateway.accountId = "not-an-account";
        }),
      ),
    /aiGateway.accountId must be null or 32 hexadecimal/iu,
  );
});

test("generates Access-mode Workshop, Context, and custom Gatekeeper configs", async () => {
  const generated = generateConfigs(validConfig, await baseConfigs());
  const vars = present(generated.workshop.vars);

  assert.equal(generated.workshop.name, "acme-cloudflare-os-backend");
  assert.deepEqual(vars.ADMINS, ["admin@example.com"]);
  assert.equal(vars.CF_ACCESS_ISS, validConfig.access.issuer);
  assert.equal(vars.CF_ACCESS_AUD, validConfig.access.audience);
  assert.equal(vars.PUBLIC_BASE_URL, "https://os.example.com");
  assert.equal(vars.CF_AI_GATEWAY, "cloudflare-os");
  assert.equal(vars.CF_AI_GATEWAY_PROVIDERS, "anthropic,cloudflare");
  assert.deepEqual(generated.workshop.ai, { binding: "WORKERS_AI" });
  assert.deepEqual(generated.workshop.services, [
    {
      binding: "ERROR_REPORTER",
      entrypoint: "ErrorReporter",
      props: {
        environment: "production",
        release: "abc123",
        service: "acme-cloudflare-os-backend",
      },
      service: "acme-cloudflare-os-errors",
    },
    {
      binding: "GATEKEEPER_CONTEXT",
      entrypoint: "GatekeeperVendor",
      props: { sharingDomain: "https://os.example.com" },
      service: "acme-cloudflare-os-context",
    },
    {
      binding: "GATEKEEPER_SCHEDULER",
      entrypoint: "GatekeeperVendor",
      service: "acme-cloudflare-os-scheduler",
    },
    {
      binding: "GATEKEEPER_CUSTOM",
      entrypoint: "GatekeeperVendor",
      service: "acme-cloudflare-os-custom",
    },
  ]);
  assert.deepEqual(generated.workshop.kv_namespaces, [
    { binding: "BLUEPRINTS", id: "blueprints-kv-id" },
    { binding: "AVATARS", id: "avatars-kv-id" },
  ]);
  assert.equal(present(generated.workshop.r2_buckets)[0].bucket_name, "cloudflare-os-blueprints");
  assert.equal(generated.context.name, "acme-cloudflare-os-context");
  assert.equal(present(generated.context.kv_namespaces)[0].id, "context-kv-id");
  assert.deepEqual(generated.context.artifacts, [{
    binding: "ARTIFACTS",
    namespace: "acme-context-collections",
  }]);
  assert.equal(generated.customGatekeeper.name, "acme-cloudflare-os-custom");
  assert.deepEqual(generated.customGatekeeper.vars, {
    CUSTOM_MESSAGE: "Use the company handbook.",
    CUSTOM_NAME: "Acme",
  });
  assert.equal(present(generated.errorReporter).name, "acme-cloudflare-os-errors");
  assert.deepEqual(present(generated.workshop.observability).logs, {
    invocation_logs: false,
  });
  assert.deepEqual(present(generated.workshop.observability).traces, {
    enabled: true,
    head_sampling_rate: 0.25,
  });
  assert.equal(
    present(generated.workshop.services).some(
      (service) => service.binding === "FRONTEND_ERROR_REPORTER",
    ),
    false,
  );
});

test("gives the router the public route, the frontend, and every service binding", async () => {
  const bases = await baseConfigs();
  const generated = generateConfigs(validConfig, bases);

  assert.equal(generated.router.name, "acme-cloudflare-os");
  assert.equal(generated.router.workers_dev, false);
  assert.deepEqual(generated.router.routes, [{ custom_domain: true, pattern: "os.example.com" }]);
  // No entrypoint on any of the three: the router forwards whole HTTP requests rather than making
  // vendor RPC calls, and the binding name is what selects the /gatekeeper/<name> path.
  assert.deepEqual(generated.router.services, [
    { binding: "WORKSHOP_BACKEND", service: "acme-cloudflare-os-backend" },
    { binding: "GATEKEEPER_CONTEXT", service: "acme-cloudflare-os-context" },
    { binding: "GATEKEEPER_SCHEDULER", service: "acme-cloudflare-os-scheduler" },
    { binding: "GATEKEEPER_CUSTOM", service: "acme-cloudflare-os-custom" },
  ]);
  // Inherited untouched: the base config already carries the ASSETS binding, the SPA fallback, and
  // the /gatekeeper/* prefix an OAuth Gatekeeper redirect needs.
  assert.deepEqual(generated.router.assets, bases.router.assets);
  assert.equal(present(generated.router.assets).binding, "ASSETS");
  assert.equal(present(generated.router.assets).directory, "../workshop-frontend/dist");
  assert.ok(
    present(present(generated.router.assets).run_worker_first).includes("/gatekeeper/*"),
    JSON.stringify(generated.router.assets),
  );
});

/**
 * The hosted deploy preinstalls this one on every fresh instance (`PREINSTALL` in
 * cloudflare-os/scripts/release/manifest-lib.ts), so a starter that skipped it would not be the same
 * topology: a migrated instance would show none of its existing schedules, and the
 * Durable Objects holding them would be orphaned behind a Worker nothing is bound to.
 */
test("deploys the ambient Scheduler Gatekeeper the hosted flow preinstalls", async () => {
  const bases = await baseConfigs();
  const generated = generateConfigs(validConfig, bases);

  assert.equal(generated.scheduler.name, "acme-cloudflare-os-scheduler");
  // Reached by both, for the two different things a Gatekeeper does: vendor RPC from the backend,
  // and whole HTTP requests under /gatekeeper/scheduler from the router.
  assert.deepEqual(
    present(generated.workshop.services).find(
      (service) => service.binding === "GATEKEEPER_SCHEDULER",
    ),
    {
      binding: "GATEKEEPER_SCHEDULER",
      entrypoint: "GatekeeperVendor",
      service: "acme-cloudflare-os-scheduler",
    });
  assert.deepEqual(
    present(generated.router.services).find(
      (service) => service.binding === "GATEKEEPER_SCHEDULER",
    ),
    { binding: "GATEKEEPER_SCHEDULER", service: "acme-cloudflare-os-scheduler" });

  // Its Durable Object history has to arrive verbatim: those classes are where the schedules live.
  assert.deepEqual(generated.scheduler.migrations, bases.scheduler.migrations);
  assert.ok(present(generated.scheduler.migrations).length > 0, "scheduler lost its DO migrations");
  // No configuration surface of its own -- which is what makes it installable with no user input
  // upstream, and deployable here from nothing but a Worker name.
  assert.equal(generated.scheduler.vars, undefined);
  assert.equal(generated.scheduler.kv_namespaces, undefined);
  assert.equal(generated.scheduler.secrets, undefined);

  const builds = buildCommands(validConfig)
    .map(({ args }) => args)
    .filter((args) => args.includes("@gadgets/gatekeeper-scheduler"));
  assert.deepEqual(builds.map((args) => args.at(-1)), ["build:app", "build"]);
});

test("keeps every Worker behind the router off the public internet", async () => {
  const generated = generateConfigs(validConfig, await baseConfigs());
  const workers = Object.entries(generated) as [string, ProdWranglerConfig][];

  for (const [name, worker] of workers) {
    if (name !== "router") {
      assert.equal(worker.workers_dev, false, `${name} answers on workers.dev`);
      assert.equal(worker.routes, undefined, `${name} carries a public route`);
    }
    // A preview URL is an unauthenticated path around the Access-protected origin.
    assert.equal(worker.preview_urls, false, `${name} leaves preview URLs enabled`);
  }
  // The router serves the frontend, so the backend uploads no assets of its own.
  assert.equal(generated.workshop.assets, undefined);
});

test("scopes PUBLIC_BASE_URL and Context sharing to the public origin", async () => {
  const onWorkersDev = variant((c) => {
    c.workers.router.route = { workersDev: true };
    c.publicBaseUrl = "https://acme-cloudflare-os.acme.workers.dev";
  });

  const derived = generateConfigs(validConfig, await baseConfigs());
  const explicit = generateConfigs(onWorkersDev, await baseConfigs());

  assert.equal(present(derived.workshop.vars).PUBLIC_BASE_URL, "https://os.example.com");
  assert.equal(
    present(explicit.workshop.vars).PUBLIC_BASE_URL,
    "https://acme-cloudflare-os.acme.workers.dev",
  );
  assert.equal(explicit.router.workers_dev, true);
  assert.equal(explicit.router.routes, undefined);

  // sharingDomain: null follows the public origin, which is what the hosted deploy sets it to.
  assert.equal(sharingDomain(derived), "https://os.example.com");
  assert.equal(sharingDomain(explicit), "https://acme-cloudflare-os.acme.workers.dev");

  // A pinned literal keeps the boundary stable across a hostname change, so it wins.
  const pinned = generateConfigs(
    variant((c) => { c.context.sharingDomain = "production"; }), await baseConfigs());
  assert.equal(sharingDomain(pinned), "production");
  assert.equal(present(pinned.workshop.vars).PUBLIC_BASE_URL, "https://os.example.com");
});

test("rejects a public origin it cannot derive or cannot trust", () => {
  // Nothing in deployment.jsonc names the account's workers.dev subdomain, and PUBLIC_BASE_URL and
  // the Context sharing boundary both need an origin, so this cannot be left to a fallback.
  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.workers.router.route = { workersDev: true };
        }),
      ),
    /publicBaseUrl is required on a workersDev route/iu,
  );

  // Scoping Context data to a hostname the deployment does not answer on hides its collections.
  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.publicBaseUrl = "https://other.example.com";
        }),
      ),
    /does not match workers.router.route.customDomain/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.publicBaseUrl = "https://os.example.com/";
        }),
      ),
    /HTTPS origin only/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          c.publicBaseUrl = "http://os.example.com";
        }),
      ),
    /HTTPS origin only/iu,
  );

  assert.throws(
    () =>
      validateConfig(
        variant((c) => {
          delete c.publicBaseUrl;
        }),
      ),
    /publicBaseUrl must be present/iu,
  );
});

test("rejects a workersDev origin that is not the router's own", async () => {
  const onWorkersDev = (publicBaseUrl: string) => variant((c) => {
    c.workers.router.route = { workersDev: true };
    c.publicBaseUrl = publicBaseUrl;
  });

  // The account's workers.dev subdomain is unknowable here, but the rest of the hostname is not: a
  // typo in the Worker label, or an unrelated host, would silently become both PUBLIC_BASE_URL and
  // the Context isolation boundary.
  assert.throws(
    () => validateConfig(onWorkersDev("https://acme-cloudflare-o.acme.workers.dev")),
    /names Worker "acme-cloudflare-o", but the router is "acme-cloudflare-os"/u,
  );

  assert.throws(
    () => validateConfig(onWorkersDev("https://os.example.com")),
    /not a workers.dev origin/iu,
  );

  // A deeper name is a preview URL or an unrelated host, not the route wrangler serves.
  assert.throws(
    () => validateConfig(onWorkersDev("https://staging.acme-cloudflare-os.acme.workers.dev")),
    /not a workers.dev origin/iu,
  );

  // The shape wrangler actually serves stays valid, whatever the account subdomain is.
  const generated = generateConfigs(
    onWorkersDev("https://acme-cloudflare-os.some-account.workers.dev"), await baseConfigs());
  assert.equal(
    present(generated.workshop.vars).PUBLIC_BASE_URL,
    "https://acme-cloudflare-os.some-account.workers.dev",
  );

  // The rule is scoped to the workersDev route. A custom domain has its own hostname, unrelated to
  // any Worker name, and is checked against `customDomain` instead -- both spellings stay valid.
  assert.equal(
    validateConfig(variant((c) => { c.publicBaseUrl = "https://os.example.com"; })).publicBaseUrl,
    "https://os.example.com");
  assert.equal(validateConfig(validConfig).publicBaseUrl, null);
});

test("routes AI Gateway over the Workers AI binding without an API token", async () => {
  const generated = generateConfigs(validConfig, await baseConfigs());
  const vars = present(generated.workshop.vars);

  assert.equal(vars.CF_AI_GATEWAY_ACCOUNT_ID, validConfig.accountId);
  // Absent, not "true": the backend takes the binding whenever it is bound, and the binding is
  // pre-authenticated inside the deployment's own account.
  assert.equal(vars.CF_AI_GATEWAY_USE_BINDING, undefined);
  assert.equal(generated.workshop.secrets, undefined);
  assert.deepEqual(aiGatewayPlan(validConfig), {
    crossAccount: false,
    gatewayAccountId: validConfig.accountId,
    needsToken: false,
    tokenReasons: [],
  });
});

test("requires a token for a gateway in another account", async () => {
  const config = variant((c) => { c.aiGateway.accountId = "fedcba9876543210fedcba9876543210"; });
  const generated = generateConfigs(config, await baseConfigs());
  const vars = present(generated.workshop.vars);

  assert.equal(vars.CF_AI_GATEWAY_ACCOUNT_ID, "fedcba9876543210fedcba9876543210");
  assert.equal(vars.CF_AI_GATEWAY_USE_BINDING, "false");
  assert.deepEqual(generated.workshop.secrets, { required: ["CF_AI_GATEWAY_API_TOKEN"] });
  // The Workers AI binding stays bound: webFetch's toMarkdown() runs on it too.
  assert.deepEqual(generated.workshop.ai, { binding: "WORKERS_AI" });
  assert.equal(present(aiGatewayPlan(config)).tokenReasons.length, 1);
});

test("treats a differently-cased account ID as the same account", async () => {
  const config = variant((c) => { c.aiGateway.accountId = c.accountId.toUpperCase(); });
  const generated = generateConfigs(config, await baseConfigs());

  // Same account written two ways, which the hex pattern accepts: the binding reaches this gateway,
  // so no CF_AI_GATEWAY_USE_BINDING opt-out and no token.
  assert.equal(present(generated.workshop.vars).CF_AI_GATEWAY_ACCOUNT_ID, validConfig.accountId);
  assert.equal(present(generated.workshop.vars).CF_AI_GATEWAY_USE_BINDING, undefined);
  assert.equal(generated.workshop.secrets, undefined);
  assert.equal(present(aiGatewayPlan(config)).crossAccount, false);
  assert.deepEqual(present(aiGatewayPlan(config)).tokenReasons, []);
});

test("requires a token for the google provider", async () => {
  const config = variant((c) => { c.aiGateway.providers = ["cloudflare", "google"]; });
  const generated = generateConfigs(config, await baseConfigs());

  assert.deepEqual(generated.workshop.secrets, { required: ["CF_AI_GATEWAY_API_TOKEN"] });
  // Same account, so the binding still carries every other provider.
  assert.equal(present(generated.workshop.vars).CF_AI_GATEWAY_USE_BINDING, undefined);
  assert.match(present(aiGatewayPlan(config)).tokenReasons[0], /google/iu);
});

test("omits disabled backend error reporting", async () => {
  const config = variant((c) => {
    c.errorReporting = { enabled: false, environment: "<ENVIRONMENT>", release: "<RELEASE>" };
  });

  const generated = generateConfigs(config, await baseConfigs());

  assert.equal(generated.errorReporter, undefined);
  assert.equal(
    present(generated.workshop.services).some((service) => service.binding === "ERROR_REPORTER"),
    false,
  );
});

test("omits dormant AI Gateway configuration", async () => {
  const config = variant((c) => {
    c.aiGateway = {
      accountId: "<AI_GATEWAY_ACCOUNT_ID>",
      enabled: false,
      name: "<AI_GATEWAY_NAME>",
      providers: [],
    };
  });

  const generated = generateConfigs(config, await baseConfigs());
  const vars = present(generated.workshop.vars);

  assert.equal(vars.CF_AI_GATEWAY, undefined);
  assert.equal(vars.CF_AI_GATEWAY_ACCOUNT_ID, undefined);
  assert.equal(vars.CF_AI_GATEWAY_PROVIDERS, undefined);
  assert.equal(generated.workshop.secrets, undefined);
  // Still bound: it is what webFetch's toMarkdown() runs on, independent of the model catalog.
  assert.deepEqual(generated.workshop.ai, { binding: "WORKERS_AI" });
  assert.equal(aiGatewayPlan(config), null);
});

test("uses the default Context Artifacts namespace when omitted", async () => {
  const config = variant((c) => { delete c.context.artifacts.namespace; });

  const generated = generateConfigs(config, await baseConfigs());

  assert.deepEqual(generated.context.artifacts, [{
    binding: "ARTIFACTS",
    namespace: "gatekeeper-context-collections",
  }]);
});

test("omits disabled Context Artifacts configuration", async () => {
  const config = variant((c) => { c.context.artifacts = {}; });
  const bases = await baseConfigs();
  bases.context.artifacts = [{ binding: "ARTIFACTS", namespace: "upstream-default" }];

  const generated = generateConfigs(config, bases);

  assert.equal(generated.context.artifacts, undefined);
});

test("defaults Context Artifacts to disabled when configuration is omitted", async () => {
  const config = variant((c) => { delete c.context.artifacts; });

  const generated = generateConfigs(config, await baseConfigs());

  assert.equal(generated.context.artifacts, undefined);
});

test("generates binding-only storage for automatic provisioning", async () => {
  const config = variant((c) => {
    c.context.kvNamespaceId = null;
    c.resources = {
      avatarsKvNamespaceId: null,
      blueprintContentBucket: null,
      blueprintsKvNamespaceId: null,
    };
  });

  const generated = generateConfigs(config, await baseConfigs());

  assert.deepEqual(generated.workshop.kv_namespaces, [
    { binding: "BLUEPRINTS" },
    { binding: "AVATARS" },
  ]);
  assert.deepEqual(generated.workshop.r2_buckets, [{ binding: "BLUEPRINT_CONTENT" }]);
  assert.deepEqual(generated.context.kv_namespaces, [{ binding: "CONTEXT_COLLECTIONS" }]);
});

/**
 * The equivalent, for this repository, of upstream's `deploy-scripts.test.ts`. That one
 * auto-discovers per-package `deploy` scripts; here deploying is centralised in `deploy.ts`, so the
 * same invariant has to be asserted against the commands it spawns.
 *
 * Both halves are silent failures: a replayed cache hit and a dropped build-time flag each exit
 * zero and each still deploy.
 */
test("never lets a deploy replay a cached build artifact", () => {
  const commands = buildCommands(validConfig);
  assert.ok(commands.length > 0, "expected at least one build command");
  for (const { args } of commands) {
    const command = args.join(" ");
    // `pnpm --filter <pkg> build` cannot see a Vite+ task, and two of the three submodule targets
    // are now tasks rather than scripts. `vp run` runs both.
    assert.ok(command.includes("vp run"),
      `build step does not go through vp run: ${command}`);
    assert.ok(command.includes("--no-cache"),
      `build step runs a vp task while deploying without --no-cache: ${command}\n` +
      "Deploys must not replay a cached artifact -- add --no-cache.");
    // Everything after the task specifier is forwarded to the task's own command, so a trailing
    // flag reaches `tsc` as an unknown option instead of reaching vp.
    assert.ok(args.indexOf("--no-cache") < args.indexOf("run") + 4,
      `--no-cache must precede the task name, not follow it: ${command}`);
  }
});

test("rebuilds the Context configurator app rather than replaying it", () => {
  // `gatekeeper-context`'s `build` script spawns `vp run --cache build:app` of its own, which the
  // outer --no-cache does not reach. Without this step a deploy ships whatever app.txt the cache
  // last archived.
  const context = buildCommands(validConfig)
    .map(({ args }) => args)
    .filter((args) => args.includes("@gadgets/gatekeeper-context"));
  assert.deepEqual(context.map((args) => args.at(-1)), ["build:app", "build"]);
  assert.ok(context.every((args) => args.at(-2) === "--no-cache"), context.join("\n"));
});

test("passes VITE_CF_ACCESS_MODE explicitly rather than inheriting it", () => {
  const withAccessMode = buildCommands(validConfig).filter(({ env }) => env);
  assert.deepEqual(withAccessMode.map(({ env }) => env), [{ VITE_CF_ACCESS_MODE: "true" }]);
  // It has to reach the frontend, which inlines it into the bundle, and nothing else.
  assert.match(withAccessMode[0].args.join(" "), /@gadgets\/workshop-frontend/u);
});

test("builds the frontend before the router", () => {
  const order = buildCommands(validConfig).map(({ args }) => args.join(" "));
  const frontend = order.findIndex((command) => command.includes("workshop-frontend"));
  const router = order.findIndex((command) => command.includes("@gadgets/router"));
  // The router deploy picks up ../workshop-frontend/dist as its assets.
  assert.ok(frontend !== -1 && router !== -1 && frontend < router, order.join("\n"));
});

test("skips the Error Reporter build when error reporting is disabled", () => {
  const config = variant((c) => {
    c.errorReporting = { enabled: false, environment: "<ENVIRONMENT>", release: null };
  });
  const commands = buildCommands(config).map(({ args }) => args.join(" "));
  assert.equal(commands.some((command) => command.includes("error-reporter")), false);
});

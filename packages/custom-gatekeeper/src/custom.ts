// oxlint-disable-next-line max-classes-per-file -- These RPC entrypoints share the Cloudflare module contract.
import type { RpcStub } from "cloudflare:workers";
import { DurableObject, RpcTarget, WorkerEntrypoint } from "cloudflare:workers";
import { skipRpcValidation, validateRpc } from "capnweb-validate";
import type {
  AccountDescription,
  ApprovalQueue,
  Gatekeeper,
  GatekeeperConnectCallback,
  GatekeeperConnectOptions,
  GatekeeperUser,
  GatekeeperUserVerifier,
  ResourceConfiguratorFrame,
  ResourceDescription,
  SupportedResource,
  VendorDescription,
} from "@gadgets/workshop-shared/gatekeeper";
import type { CustomDeploymentInfo, CustomSession } from "./types.js";
import TYPES_CODE from "./types-code.js";

const CUSTOM_ICON = {
  url: `data:image/svg+xml,${encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='none' stroke='currentColor' stroke-width='20'><path d='M52 72h152v112H52z'/><path d='m52 88 76 52 76-52'/></svg>",
  )}`,
};

type ObservationQueue = Pick<ApprovalQueue, "authorizeObservation"> &
  Partial<{ [Symbol.dispose]: () => void }>;

export const describeCustomVendor = (): VendorDescription => ({
  autoProvisionsAccount: true,
  color: "#e8f2ff",
  description:
    "A minimal Gatekeeper to copy when connecting CloudflareOS to your organization's systems.",
  displayName: "Custom Gatekeeper",
  logo: CUSTOM_ICON,
  providesAuth: false,
  tagline: "Example organization-specific capability",
  url: "https://github.com/cloudflare/cloudflare-os-starter",
});

export const describeCustomAccount = (): AccountDescription => ({
  avatar: CUSTOM_ICON,
  displayName: "Custom Gatekeeper",
  singleton: { tsType: "CustomSession" },
});

@validateRpc()
export class CustomSessionImpl extends RpcTarget implements CustomSession {
  readonly #approvalQueue: ObservationQueue;
  readonly #info: CustomDeploymentInfo;

  constructor(approvalQueue: ObservationQueue, info: CustomDeploymentInfo) {
    super();
    this.#approvalQueue = approvalQueue;
    this.#info = info;
  }

  async getDeploymentInfo(): Promise<CustomDeploymentInfo> {
    await this.#approvalQueue.authorizeObservation({
      description: "Read the custom information configured by this deployment.",
      title: "Read deployment information",
    });
    return this.#info;
  }

  [Symbol.dispose](): void {
    this.#approvalQueue[Symbol.dispose]?.();
  }
}

@validateRpc()
export class CustomGatekeeper extends DurableObject<Cloudflare.Env> implements Gatekeeper<CustomSession> {
  // oxlint-disable-next-line class-methods-use-this, require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async describe(): Promise<ResourceDescription> {
    return {
      snippet: "Organization-specific information supplied by this deployment.",
      suggestedBindingName: "CUSTOM",
      title: "Deployment information",
      tsType: "CustomSession",
      url: "custom://deployment-info",
    };
  }

  // oxlint-disable-next-line class-methods-use-this, require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async getTypeScriptTypes(): Promise<string> {
    return TYPES_CODE;
  }

  // oxlint-disable-next-line class-methods-use-this, require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async getAutoApprovableActions(): Promise<[]> {
    return [];
  }

  // oxlint-disable-next-line require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async startSession(approvalQueue: RpcStub<ApprovalQueue>): Promise<CustomSession> {
    return new CustomSessionImpl(approvalQueue.dup(), {
      message: this.env.CUSTOM_MESSAGE,
      name: this.env.CUSTOM_NAME,
    });
  }

  // oxlint-disable-next-line class-methods-use-this -- Cloudflare RPC exposes this operation on the instance.
  async addObserver(_id: string, _user: Fetcher<GatekeeperUserVerifier>): Promise<void> {
    // This RPC operation has no local state to update.
  }
  // oxlint-disable-next-line class-methods-use-this -- Cloudflare RPC exposes this operation on the instance.
  async removeObserver(_id: string): Promise<void> {
    // This RPC operation has no local state to update.
  }

  // oxlint-disable-next-line class-methods-use-this, require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async applyAction(action: number): Promise<void> {
    throw new Error(`Custom Gatekeeper has no actions (${action}).`);
  }

  // oxlint-disable-next-line class-methods-use-this -- Cloudflare RPC exposes this operation on the instance.
  async rejectAction(_action: number): Promise<void> {
    // This RPC operation has no local state to update.
  }

  // oxlint-disable-next-line class-methods-use-this, require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async revertAction(_action: number): Promise<void> {
    throw new Error("Custom Gatekeeper has no actions to revert.");
  }
}

@validateRpc()
export class CustomAccount extends WorkerEntrypoint<Cloudflare.Env> implements GatekeeperUser {
  // oxlint-disable-next-line class-methods-use-this, require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async describe(): Promise<AccountDescription> {
    return describeCustomAccount();
  }

  // oxlint-disable-next-line require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async getSingletonGatekeeperClass(): Promise<DurableObjectClass<Gatekeeper<CustomSession>>> {
    return this.ctx.exports.CustomGatekeeper({});
  }

  // oxlint-disable-next-line class-methods-use-this, require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async getSupportedResources(): Promise<SupportedResource[]> {
    return [];
  }

  // oxlint-disable-next-line class-methods-use-this -- Cloudflare RPC exposes this operation on the instance.
  getGatekeeperClassFor(_url: string): never {
    throw new Error("Custom Gatekeeper has no URL-addressed resources.");
  }

  // oxlint-disable-next-line class-methods-use-this -- Cloudflare RPC exposes this operation on the instance.
  startResourceConfigurator(_resourceUrlPattern: string): Promise<ResourceConfiguratorFrame> {
    throw new Error("Custom Gatekeeper has no URL-addressed resources.");
  }

  // oxlint-disable-next-line class-methods-use-this, require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async ensureResources(_resourceUrlPatterns: string[]): Promise<{ url?: string }> {
    return {};
  }

  // oxlint-disable-next-line class-methods-use-this -- Cloudflare RPC exposes this operation on the instance.
  async revoke(): Promise<void> {
    // This RPC operation has no local state to update.
  }

  // oxlint-disable-next-line class-methods-use-this -- Cloudflare RPC exposes this operation on the instance.
  reconnect(): Promise<{ url: string }> {
    throw new Error("Custom Gatekeeper has no credentials to reconnect.");
  }

  // oxlint-disable-next-line class-methods-use-this, require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async getAuthenticatedEmail(): Promise<string | null> {
    return null;
  }

  @skipRpcValidation()
  // oxlint-disable-next-line require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async getVerifier(): Promise<Fetcher<GatekeeperUserVerifier>> {
    return this.ctx.exports.CustomVerifier({});
  }
}

@validateRpc()
export class CustomVerifier extends WorkerEntrypoint<Cloudflare.Env> implements GatekeeperUserVerifier {
  // oxlint-disable-next-line class-methods-use-this -- Cloudflare RPC exposes this operation on the instance.
  verify(): void {
    // This RPC operation has no local state to update.
  }
}

@validateRpc()
export class GatekeeperVendor extends WorkerEntrypoint<Cloudflare.Env> {
  // oxlint-disable-next-line class-methods-use-this, require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async describe(): Promise<VendorDescription> {
    return describeCustomVendor();
  }

  @skipRpcValidation()
  // oxlint-disable-next-line require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async createAccount(): Promise<Fetcher<GatekeeperUser>> {
    return this.ctx.exports.CustomAccount({});
  }

  // oxlint-disable-next-line class-methods-use-this -- Cloudflare RPC exposes this operation on the instance.
  connectAccount(
    _callback: Fetcher<GatekeeperConnectCallback>,
    _options?: GatekeeperConnectOptions,
  ): Promise<{ url: string }> {
    throw new Error("Custom Gatekeeper is auto-provisioned and has no connect flow.");
  }

  // oxlint-disable-next-line class-methods-use-this, require-await -- The RPC contract requires asynchronous instance methods with promise-based results.
  async getSupportedResources(_options?: { userId?: string }): Promise<SupportedResource[]> {
    return [];
  }

  // oxlint-disable-next-line require-await, class-methods-use-this -- The RPC contract requires asynchronous instance methods with promise-based results.
  async getTypeScriptTypes(): Promise<string> {
    return TYPES_CODE;
  }
}

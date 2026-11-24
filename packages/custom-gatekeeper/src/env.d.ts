import type * as workerModule from "./index.js";

declare global {
  namespace Cloudflare {
    interface GlobalProps {
      mainModule: typeof workerModule;
      durableNamespaces: "CustomGatekeeper";
    }
  }
}

export * from "./custom.js";

export default {
  fetch(): Response {
    return new Response("Custom Gatekeeper worker is running.", {
      headers: { "content-type": "text/plain" },
    });
  },
};

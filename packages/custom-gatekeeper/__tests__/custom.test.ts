import { describe, expect, it } from "vitest";
import { CustomSessionImpl, describeCustomAccount, describeCustomVendor } from "../src/custom.ts";

describe("custom-gatekeeper", () => {
  it("describes an auto-provisioned singleton", () => {
    expect(describeCustomVendor()).toMatchObject({
      autoProvisionsAccount: true,
      displayName: "Custom Gatekeeper",
      providesAuth: false,
    });
    expect(describeCustomAccount()).toMatchObject({
      displayName: "Custom Gatekeeper",
      singleton: { tsType: "CustomSession" },
    });
  });

  it("authorizes the observation before returning deployment information", async () => {
    const observations = { disposed: false, value: undefined as unknown };
    const session = new CustomSessionImpl(
      {
        authorizeObservation(value: unknown) {
          observations.value = value;
          return Promise.resolve();
        },
        [Symbol.dispose]() {
          observations.disposed = true;
        },
      },
      { message: "Use the internal handbook.", name: "Acme" },
    );

    await expect(session.getDeploymentInfo()).resolves.toEqual({
      message: "Use the internal handbook.",
      name: "Acme",
    });
    expect(observations.value).toEqual({
      description: "Read the custom information configured by this deployment.",
      title: "Read deployment information",
    });

    session[Symbol.dispose]();
    expect(observations.disposed).toBe(true);
  });
});

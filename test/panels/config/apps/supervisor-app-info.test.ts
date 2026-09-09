import { ContextProvider } from "@lit/context";
import { afterEach, assert, beforeEach, describe, it, vi } from "vitest";
import {
  apiContext,
  internationalizationContext,
  registriesContext,
  statesContext,
} from "../../../../src/data/context";
import type { HassioAddonDetails } from "../../../../src/data/hassio/addon";
import "../../../../src/panels/config/apps/app-view/info/supervisor-app-info";

const addon = (state: string) =>
  ({
    slug: "test_app",
    name: "Test app",
    description: "Test app",
    stage: "stable",
    state,
    version: "1.0",
    version_latest: "1.0",
    update_available: false,
    available: true,
    ingress: false,
    webui: "http://[HOST]:8080/",
    hostname: "test-app",
    logo: false,
    icon: false,
    url: null,
    repository: "core",
    advanced: false,
    detached: false,
    homeassistant: "1",
    installed: true,
    build: false,
    protected: true,
    apparmor: "profile",
    hassio_api: false,
    hassio_role: "default",
    startup: "application",
    boot: "auto",
    auto_update: false,
    watchdog: false,
    ingress_panel: false,
    system_managed: false,
    rating: 8,
  }) as unknown as HassioAddonDetails;

describe("supervisor-app-info", () => {
  let host: HTMLDivElement;

  const mount = async (
    callWS: (msg: any) => Promise<any>,
    initialAddon: HassioAddonDetails
  ) => {
    host = document.createElement("div");
    document.body.append(host);
    new ContextProvider(host, {
      context: internationalizationContext,
      initialValue: { localize: (key: string) => key } as any,
    });
    new ContextProvider(host, {
      context: registriesContext,
      initialValue: { devices: {}, entities: {}, areas: {}, floors: {} } as any,
    });
    new ContextProvider(host, {
      context: apiContext,
      initialValue: { callWS: (msg: any) => callWS(msg) } as any,
    });
    new ContextProvider(host, {
      context: statesContext,
      initialValue: {} as any,
    });

    const el = document.createElement("supervisor-app-info") as any;
    el.addon = initialAddon;
    host.append(el);
    await el.updateComplete;
    return el;
  };

  beforeEach(() => {
    vi.stubGlobal("matchMedia", (media: string) => ({
      media,
      matches: false,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    vi.useFakeTimers();
  });

  afterEach(() => {
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Starting an app makes the Supervisor slow to answer, so the polled info
  // requests overlap and can come back out of order. An older answer must not
  // put a running app back to starting, which leaves the page on its spinner
  // with no way to open the app until a reload.
  it("keeps the newest state when an older info response arrives last", async () => {
    const responses = [
      { delay: 200, state: "startup" },
      { delay: 50, state: "started" },
    ];
    let call = 0;
    const callWS = vi.fn(async (msg: any) => {
      if (msg.endpoint !== "/addons/test_app/info") {
        return {};
      }
      const response = responses[call++] ?? { delay: 0, state: "started" };
      await new Promise((resolve) => {
        setTimeout(resolve, response.delay);
      });
      return addon(response.state);
    });

    const el = await mount(callWS, addon("startup"));

    const refreshes = Promise.all([
      el._refreshAddonInfo(),
      el._refreshAddonInfo(),
    ]);
    await vi.advanceTimersByTimeAsync(250);
    await refreshes;
    await el.updateComplete;

    assert.equal(el._currentAddon.state, "started");
  });
});

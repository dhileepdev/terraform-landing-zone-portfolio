// Runs Floci as the local AWS emulator microservice: `floci start` launches
// the container; the service supervises it and stops it on shutdown.

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export async function flociIsReachable(endpoint) {
  try {
    await fetch(endpoint, { method: "GET", cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}

export async function waitForEndpoint(endpoint, { timeoutMs = 20_000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await flociIsReachable(endpoint)) return true;
    await delay(intervalMs);
  }
  return false;
}

export function startFloci({ bin = "floci", endpoint = "http://localhost:4566" } = {}) {
  const child = spawn(bin, ["start", "--endpoint", endpoint], { stdio: ["ignore", "inherit", "inherit"] });
  child.on("error", (err) =>
    console.warn(`[state-graph] could not run ${bin}: ${err.message} — start Floci manually? (curl -fsSL https://floci.io/install.sh | sh)`)
  );
  return child;
}

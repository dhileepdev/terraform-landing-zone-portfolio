import { put as putBlob } from "@vercel/blob";
import { generateTrends, type SimulatedTrends } from "./simulator";

// Storage of the simulated trends: the Floci emulator in development,
// Vercel Blob when the dashboard is deployed remotely.

// Where the emulator lives — defaults to localhost:4566; set FLOCI_ENDPOINT
// (e.g. http://192.168.1.10:4566) to serve the simulated trends from a
// remote Floci host.
const FLOCI_ENDPOINT = (process.env.FLOCI_ENDPOINT ?? "http://localhost:4566").replace(/\/+$/, "");
const FLOCI_BUCKET = "portfolio-dashboard-state";
const FLOCI_KEY = "sim/trends.json";
const BLOB_KEY = "dashboard-trends.json";

function parseStored(json: unknown): SimulatedTrends | null {
  if (!json || typeof json !== "object") return null;
  return Array.isArray((json as { cost?: unknown }).cost) ? (json as SimulatedTrends) : null;
}

async function flociGet(): Promise<SimulatedTrends | null> {
  try {
    const res = await fetch(`${FLOCI_ENDPOINT}/${FLOCI_BUCKET}/${FLOCI_KEY}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return parseStored(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

async function flociPut(trends: SimulatedTrends): Promise<void> {
  try {
    await fetch(`${FLOCI_ENDPOINT}/${FLOCI_BUCKET}`, { method: "PUT" }); // create bucket if absent
    await fetch(`${FLOCI_ENDPOINT}/${FLOCI_BUCKET}/${FLOCI_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trends),
    });
  } catch {
    // Emulator not running — trends regenerate when it is reachable again.
  }
}

async function blobGet(): Promise<SimulatedTrends | null> {
  try {
    const res = await fetch(`https://public.blob.vercel-storage.com/${BLOB_KEY}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return parseStored(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

async function blobPut(trends: SimulatedTrends): Promise<void> {
  try {
    await putBlob(BLOB_KEY, JSON.stringify(trends), { access: "public" });
  } catch {
    // Blob not configured locally — nothing breaks, the data regenerates if needed.
  }
}

export async function getTrends(): Promise<SimulatedTrends> {
  const fromEmulator = await flociGet();
  if (fromEmulator) return { ...fromEmulator, source: "floci" };

  const fromBlob = await blobGet();
  if (fromBlob) return { ...fromBlob, source: "blob" };

  const generated = generateTrends();
  void flociPut(generated);
  void blobPut(generated);
  return generated;
}

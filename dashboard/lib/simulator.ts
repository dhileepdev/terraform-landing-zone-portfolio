// Deterministic seeded trend generator for the terraform landing zone.
// The simulated series backs the /trends page while the data lives in the
// Floci emulator (or, remotely, in Vercel Blob).

export type SimCostPoint = {
  month: string; // "2026-11"
  spend: number;
  topService: string;
};

export type SimPipelineRun = {
  id: string;
  status: string;
  workflow: string;
  runId: number;
  updatedAt: string;
};

export type SimDriftCheck = {
  checkedAt: string;
  driftDetected: boolean;
  changedResources: number;
};

export type SimulatedTrends = {
  source?: "generated" | "floci" | "blob";
  cost: SimCostPoint[];
  pipeline: SimPipelineRun[];
  drift: SimDriftCheck[];
};

const SEED = 20261122;
const COST_MONTHS = 12;
const PIPELINE_RUNS = 12;
const DRIFT_CHECKS = 10;
const PIPELINE_STATUSES = ["success", "success", "success", "failure", "cancelled"];
const PIPELINE_WORKFLOW = "terraform.yml";
const TOP_SERVICES = ["AmazonEC2", "AmazonVPC", "AmazonRoute53", "AmazonS3"];

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function generateTrends(now: Date = new Date()): SimulatedTrends {
  const rng = mulberry32(SEED);
  const current = new Date(now.getFullYear(), now.getMonth(), 1);

  // Monthly cloud cost trend: 12 months, oldest first, ~9% monthly growth.
  const cost: SimCostPoint[] = [];
  let spend = 5200;
  for (let i = 0; i < COST_MONTHS; i++) {
    const month = addMonths(current, i - (COST_MONTHS - 1));
    if (i > 0) {
      spend = Math.max(300, Math.round(spend * 1.09 + rng() * 80 - 40));
    }
    const topService =
      rng() < 0.6 ? "AmazonEC2" : TOP_SERVICES[Math.floor(rng() * TOP_SERVICES.length)];
    cost.push({ month: monthKey(month), spend, topService });
  }

  // Recent pipeline runs: newest first, ~1.5 day cadence over the last 30 days.
  const pipeline: SimPipelineRun[] = [];
  for (let i = 0; i < PIPELINE_RUNS; i++) {
    const idx = PIPELINE_RUNS - 1 - i; // 0 = oldest
    const at = Date.now() - 30 * 24 * 3600e3 + idx * 1.6 * 24 * 3600e3 + rng() * 3600e3;
    pipeline.push({
      id: `sim-run-${i + 1}`,
      status: PIPELINE_STATUSES[Math.floor(rng() * PIPELINE_STATUSES.length)],
      workflow: PIPELINE_WORKFLOW,
      runId: 8800 + (PIPELINE_RUNS - 1 - i) * 6,
      updatedAt: new Date(at).toISOString(),
    });
  }
  pipeline.reverse(); // newest first

  // Drift checks: every 6h like the scheduled drift workflow, newest first.
  const drift: SimDriftCheck[] = [];
  for (let i = 0; i < DRIFT_CHECKS; i++) {
    const at = Date.now() - i * 6 * 3600e3 - rng() * 3600e3;
    const driftDetected = rng() < 0.3;
    drift.push({
      checkedAt: new Date(at).toISOString(),
      driftDetected,
      changedResources: driftDetected ? 1 + Math.floor(rng() * 4) : 0,
    });
  }
  drift.reverse();

  return { source: "generated", cost, pipeline, drift };
}

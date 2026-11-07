import { getState } from "@/lib/blob";

type DriftStatus = {
  driftDetected: boolean;
  changedResources: any[];
  lastChecked: string;
};

const EMPTY: DriftStatus = {
  driftDetected: false,
  changedResources: [],
  lastChecked: "—",
};

export async function GET(_request: Request) {
  try {
    const driftUrl =
      process.env.DRIFT_JSON_URL ||
      (process.env.GITHUB_REPOSITORY
        ? `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/main/drift/last-run.json`
        : "");

    if (!driftUrl) throw new Error("no drift URL configured");

    const res = await fetch(driftUrl, { cache: "no-store" });

    if (!res.ok) throw new Error(`drift JSON: ${res.status}`);

    const data = await res.json();

    return Response.json({
      driftDetected: data.driftDetected ?? false,
      changedResources: data.changedResources ?? [],
      lastChecked: data.last_checked ?? data.lastChecked ?? "—",
    });
  } catch {
    const fallback = (await getState<DriftStatus>(EMPTY)) ?? EMPTY;
    return Response.json(fallback, { status: 503 });
  }
}

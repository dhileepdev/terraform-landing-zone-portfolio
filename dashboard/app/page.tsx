"use client";

import { useState, useEffect } from "react";
import { getState as getBlobState, setState as setBlobState } from "@/lib/blob";
import PipelineStatus from "@/components/PipelineStatus";
import DriftStatus from "@/components/DriftStatus";
import CostCard from "@/components/CostCard";
import LastUpdated from "@/components/LastUpdated";

type DashboardState = {
  pipeline: { status: string; workflow: string; runId: number; updatedAt: string } | null;
  drift: { driftDetected: boolean; changedResources: any[]; lastChecked: string } | null;
  cost: { currentMonthSpend: number; trend: string; topService: string; lastChecked: string } | null;
};

const EMPTY: DashboardState = {
  pipeline: null,
  drift: null,
  cost: null,
};

const POLL_INTERVAL_MS = 30_000;

export default function Page() {
  const [state, setState] = useState<DashboardState>(EMPTY);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      try {
        const [pipelineRes, driftRes, costRes] = await Promise.allSettled([
          fetch("/api/pipeline"),
          fetch("/api/drift"),
          fetch("/api/cost"),
        ]);

        const pipeline =
          pipelineRes.status === "fulfilled" && pipelineRes.value.ok
            ? (await pipelineRes.value.json())
            : null;
        const drift =
          driftRes.status === "fulfilled" && driftRes.value.ok
            ? (await driftRes.value.json())
            : null;
        const cost =
          costRes.status === "fulfilled" && costRes.value.ok
            ? (await costRes.value.json())
            : null;

        if (!mounted) return;

        const allFailed = pipeline === null && drift === null && cost === null;

        if (allFailed) {
          const fallback = await getBlobState<DashboardState>(EMPTY);
          setState(fallback);
          setStale(true);
        } else {
          const newState: DashboardState = { pipeline, drift, cost };
          try {
            await setBlobState(newState); // persist to Blob
          } catch {
            // Blob not configured — state won't persist across invocations
          }
          setState(newState);
          setStale(false);
        }
      } catch {
        if (!mounted) return;
        const fallback = await getBlobState<DashboardState>(EMPTY);
        setState(fallback);
        setStale(true);
      }
    };

    void fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const lastChecked =
    state.pipeline?.updatedAt ??
    state.drift?.lastChecked ??
    state.cost?.lastChecked ??
    null;

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Terraform Landing Zone Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <PipelineStatus
          run={{
            status: state.pipeline?.status ?? "unknown",
            workflow: state.pipeline?.workflow ?? "—",
            runId: state.pipeline?.runId ?? 0,
            updatedAt: state.pipeline?.updatedAt ?? "—",
          }}
        />
        <DriftStatus
          drift={{
            driftDetected: state.drift?.driftDetected ?? false,
            changedResources: state.drift?.changedResources ?? [],
            lastChecked: state.drift?.lastChecked ?? "—",
          }}
        />
        <CostCard
          cost={{
            currentMonthSpend: state.cost?.currentMonthSpend ?? 0,
            trend: state.cost?.trend ?? "no data",
            topService: state.cost?.topService ?? "—",
            lastChecked: state.cost?.lastChecked ?? "—",
          }}
        />
      </div>
      <LastUpdated timestamp={lastChecked} />
      {stale && (
        <p className="text-yellow-600 text-sm mt-2">
          Showing stale state — some APIs unreachable.
        </p>
      )}
    </main>
  );
}

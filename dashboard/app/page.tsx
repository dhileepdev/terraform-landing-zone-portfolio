"use client";

import { useState, useEffect, useRef } from "react";
import { getState as getBlobState, setState as setBlobState } from "@/lib/blob";
import PipelineStatus from "@/components/PipelineStatus";
import DriftStatus from "@/components/DriftStatus";
import CostCard from "@/components/CostCard";

type DashboardState = {
  pipeline: { status: string; workflow: string; runId: number; updatedAt: string } | null;
  drift: { driftDetected: boolean; changedResources: any[]; lastChecked: string } | null;
  cost: { currentMonthSpend: number; trend: string; topService: string; lastChecked: string } | null;
};

const EMPTY: DashboardState = { pipeline: null, drift: null, cost: null };
const POLL_INTERVAL_MS = 30_000;

export default function Page() {
  const [state, setState] = useState<DashboardState>(EMPTY);
  const [stale, setStale] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const runFetch = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      try {
        const [pipelineRes, driftRes, costRes] = await Promise.allSettled([
          fetch("/api/pipeline"), fetch("/api/drift"), fetch("/api/cost"),
        ]);
        const pipeline = pipelineRes.status === "fulfilled" && pipelineRes.value.ok ? (await pipelineRes.value.json()) : null;
        const drift = driftRes.status === "fulfilled" && driftRes.value.ok ? (await driftRes.value.json()) : null;
        const cost = costRes.status === "fulfilled" && costRes.value.ok ? (await costRes.value.json()) : null;
        if (!mounted) return;
        setFresh(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        const allFailed = pipeline === null && drift === null && cost === null;
        if (allFailed) {
          const fallback = await getBlobState<DashboardState>(EMPTY);
          setState(fallback);
          setStale(true);
        } else {
          const newState: DashboardState = { pipeline, drift, cost };
          try {
            await setBlobState(newState);
          } catch {
            // Blob not configured locally
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
    runFetch.current = fetchAll;
    const interval = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const p = state.pipeline;
  const d = state.drift;
  const c = state.cost;

  return (
    <div className="space-y-[12px]">
      <div className="title-row">
        <div>
          <h1 className="text-[#0a0a0a]">Terraform Landing Zone</h1>
          <p className="muted text-[11px] mt-1">CI/CD pipeline runs &bull; infrastructure drift &bull; cloud cost</p>
        </div>
        <div className="title-actions">
          <button className="btn btn-outline" onClick={() => runFetch.current?.()}>Refresh</button>
          <span className="muted text-[11px]">Updated {fresh ?? "—"}</span>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">Pipeline</span>
          <button className="btn btn-outline">View all</button>
        </div>
        <div className="flat-card">
          <PipelineStatus
            run={{
              status: p?.status ?? "unknown",
              workflow: p?.workflow ?? "—",
              runId: p?.runId ?? 0,
              updatedAt: p?.updatedAt ?? "—",
            }}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">Drift</span>
          <button className="btn btn-outline">View all</button>
        </div>
        <div className="flat-card">
          <DriftStatus
            drift={{
              driftDetected: d?.driftDetected ?? false,
              changedResources: d?.changedResources ?? [],
              lastChecked: d?.lastChecked ?? "—",
            }}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">Cloud cost</span>
          <button className="btn btn-outline">View all</button>
        </div>
        <div className="flat-card">
          <CostCard
            cost={{
              currentMonthSpend: c?.currentMonthSpend ?? 0,
              trend: c?.trend ?? "no data",
              topService: c?.topService ?? "—",
              lastChecked: c?.lastChecked ?? "—",
            }}
          />
        </div>
      </div>

      {stale && (
        <div className="section">
          <div className="flat-card" style={{ padding: "10px 24px" }}>
            <span className="dot dot-bad"></span>
            <span className="muted text-[11px]">Showing stale state — some APIs unreachable.</span>
          </div>
        </div>
      )}
    </div>
  );
}

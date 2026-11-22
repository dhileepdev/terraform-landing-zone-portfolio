"use client";

import { useEffect, useState } from "react";
import CostTrendChart from "@/components/CostTrendChart";
import DriftTimeline from "@/components/DriftTimeline";
import PipelineTimeline from "@/components/PipelineTimeline";
import type { SimulatedTrends } from "@/lib/simulator";

const POLL_INTERVAL_MS = 30_000;

export default function TrendsPage() {
  const [trends, setTrends] = useState<SimulatedTrends | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/trends");
        if (res.ok && mounted) setTrends(await res.json());
      } catch {
        // ignore — retried on the next poll
      }
    };
    void load();
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const cost = trends?.cost ?? [];
  const pipeline = trends?.pipeline ?? [];
  const drift = trends?.drift ?? [];

  return (
    <div className="space-y-[12px]">
      <div className="title-row">
        <div>
          <h1 className="text-[#0a0a0a]">Landing-zone trends</h1>
          <p className="muted text-[11px] mt-1">
            Pipeline runs, drift history, and cloud cost — simulated on the Floci emulator
          </p>
        </div>
        <span className="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-600 uppercase tracking-wide text-[#6b6b6b]">
          Simulated
        </span>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">Monthly cloud cost</span>
        </div>
        <div className="flat-card">
          <CostTrendChart points={cost} />
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">Recent pipeline runs</span>
        </div>
        <div className="flat-card">
          <PipelineTimeline runs={pipeline} />
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">Drift history</span>
        </div>
        <div className="flat-card">
          <DriftTimeline checks={drift} />
        </div>
      </div>
    </div>
  );
}

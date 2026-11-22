"use client";

import { useEffect, useState } from "react";
import PipelineStatus from "@/components/PipelineStatus";

type PipelineRun = {
  status: string;
  workflow: string;
  runId: number;
  updatedAt: string;
};

const EMPTY: PipelineRun = {
  status: "unknown",
  workflow: "—",
  runId: 0,
  updatedAt: "—",
};

export default function PipelinePage() {
  const [run, setRun] = useState<PipelineRun>(EMPTY);

  useEffect(() => {
    let mounted = true;
    fetch("/api/pipeline")
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (mounted) setRun((data as PipelineRun | null) ?? EMPTY);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-[12px]">
      <h1 className="text-[#0a0a0a]">Pipeline</h1>
      <p className="muted text-[11px] mt-1">CI/CD pipeline runs</p>
      <div className="section">
        <div className="section-head">
          <span className="section-title">Latest run</span>
        </div>
        <div className="flat-card">
          <PipelineStatus run={run} />
        </div>
      </div>
    </div>
  );
}

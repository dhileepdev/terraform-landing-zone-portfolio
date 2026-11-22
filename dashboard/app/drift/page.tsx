"use client";

import { useEffect, useState } from "react";
import DriftStatus from "@/components/DriftStatus";

type DriftData = {
  driftDetected: boolean;
  changedResources: any[];
  lastChecked: string;
};

const EMPTY: DriftData = {
  driftDetected: false,
  changedResources: [],
  lastChecked: "—",
};

export default function DriftPage() {
  const [drift, setDrift] = useState<DriftData>(EMPTY);

  useEffect(() => {
    let mounted = true;
    fetch("/api/drift")
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (mounted) setDrift((data as DriftData | null) ?? EMPTY);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-[12px]">
      <h1 className="text-[#0a0a0a]">Drift</h1>
      <p className="muted text-[11px] mt-1">Infrastructure drift detection</p>
      <div className="section">
        <div className="section-head">
          <span className="section-title">Drift state</span>
        </div>
        <div className="flat-card">
          <DriftStatus drift={drift} />
        </div>
      </div>
    </div>
  );
}

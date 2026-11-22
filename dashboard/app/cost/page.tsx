"use client";

import { useEffect, useState } from "react";
import CostCard from "@/components/CostCard";

type CostData = {
  currentMonthSpend: number;
  trend: string;
  topService: string;
  lastChecked: string;
};

const EMPTY: CostData = {
  currentMonthSpend: 0,
  trend: "no data",
  topService: "—",
  lastChecked: "—",
};

export default function CostPage() {
  const [cost, setCost] = useState<CostData>(EMPTY);

  useEffect(() => {
    let mounted = true;
    fetch("/api/cost")
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (mounted) setCost((data as CostData | null) ?? EMPTY);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-[12px]">
      <h1 className="text-[#0a0a0a]">Cost</h1>
      <p className="muted text-[11px] mt-1">Cloud spend by month</p>
      <div className="section">
        <div className="section-head">
          <span className="section-title">Current month</span>
        </div>
        <div className="flat-card">
          <CostCard cost={cost} />
        </div>
      </div>
    </div>
  );
}

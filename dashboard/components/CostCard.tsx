type CostData = {
  currentMonthSpend: number;
  trend: string;
  topService: string;
  lastChecked: string;
};

export default function CostCard({ cost }: { cost: CostData }) {
  const trendTone = cost.trend.includes("-") || cost.trend.toLowerCase().includes("down") ? "text-[#c4242a]" : cost.trend.toLowerCase().includes("up") ? "text-[#2e7d32]" : "text-[#6b6b6b]";

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="num text-3xl font-700 text-[#0a0a0a]">${cost.currentMonthSpend.toFixed(2)}</span>
        <span className="kpi-unit">this month</span>
      </div>
      <div className={`change ${trendTone}`}>{cost.trend}</div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="muted text-[11px]">Top service:</span>
        <span className="num text-[12px]">{cost.topService}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="muted text-[11px]">Checked:</span>
        <span className="num text-[12px]">{cost.lastChecked}</span>
      </div>
    </div>
  );
}

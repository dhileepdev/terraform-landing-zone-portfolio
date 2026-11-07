type CostData = {
  currentMonthSpend: number;
  trend: string;
  topService: string;
  lastChecked: string;
};

export default function CostCard({ cost }: { cost: CostData }) {
  return (
    <div className="bg-white p-4 rounded shadow border">
      <h2 className="font-semibold mb-2">Cloud Cost</h2>
      <p className="text-sm font-medium">{`$${cost.currentMonthSpend.toFixed(2)}`}</p>
      <p className="text-xs text-gray-500">{cost.trend} vs last month</p>
      <p className="text-xs text-gray-500">top: {cost.topService}</p>
      <p className="text-xs text-gray-500">{cost.lastChecked}</p>
    </div>
  );
}

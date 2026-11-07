type DriftStatus = {
  driftDetected: boolean;
  changedResources: any[];
  lastChecked: string;
};

export default function DriftStatus({ drift }: { drift: DriftStatus }) {
  return (
    <div className="bg-white p-4 rounded shadow border">
      <h2 className="font-semibold mb-2">Drift</h2>
      <p className={`text-sm font-medium ${
        drift.driftDetected ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50"
      }`}>
        {drift.driftDetected ? "drift detected" : "no drift"}
      </p>
      <p className="text-xs text-gray-500">
        {drift.changedResources.length} changed
      </p>
      <p className="text-xs text-gray-500">{drift.lastChecked}</p>
    </div>
  );
}

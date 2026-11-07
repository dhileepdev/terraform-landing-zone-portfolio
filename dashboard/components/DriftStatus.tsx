type DriftStatus = {
  driftDetected: boolean;
  changedResources: any[];
  lastChecked: string;
};

export default function DriftStatus({ drift }: { drift: DriftStatus }) {
  return (
    <div className="space-y-3">
      <span className={`status-chip ${drift.driftDetected ? "chip-bad" : "chip-ok"}`}>
        {drift.driftDetected ? "drift detected" : "no drift"}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="num text-xl font-600">{drift.changedResources.length}</span>
        <span className="muted text-[12px]">changed resources</span>
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="muted text-[11px]">Checked:</span>
        <span className="num text-[12px]">{drift.lastChecked}</span>
      </div>
    </div>
  );
}

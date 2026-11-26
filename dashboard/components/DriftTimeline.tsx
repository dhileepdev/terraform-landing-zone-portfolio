import type { SimDriftCheck } from "@/lib/simulator";

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DriftTimeline({ checks }: { checks: SimDriftCheck[] }) {
  const ordered = checks.slice().reverse(); // newest first
  if (!ordered.length) {
    return <p className="muted text-[12px]">No drift checks in the simulation yet.</p>;
  }
  return (
    <div className="space-y-4">
      {ordered.map((check, i) => (
        <div key={check.checkedAt} className="relative pl-7 tl-fade" style={{ animationDelay: `${i * 70}ms` }}>
          <span className={`absolute -left-px top-2 dot ${check.driftDetected ? "dot-bad" : "dot-ok"}`} aria-hidden />
          <div className="flex items-baseline gap-2">
            <span className={`status-chip ${check.driftDetected ? "chip-bad" : "chip-ok"}`}>
              {check.driftDetected ? "drift detected" : "no drift"}
            </span>
            <span className="muted text-[11px]">{check.changedResources} changed</span>
          </div>
          <div className="muted text-[11px]">{fmtWhen(check.checkedAt)}</div>
        </div>
      ))}
    </div>
  );
}

import type { SimPipelineRun } from "@/lib/simulator";

function isBadStatus(status: string): boolean {
  return status === "failure" || status === "cancelled";
}

function dotClass(status: string): string {
  return isBadStatus(status) ? "dot-bad" : "dot-ok";
}

function chipClass(status: string): string {
  return isBadStatus(status) ? "chip-bad" : "chip-ok";
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PipelineTimeline({ runs }: { runs: SimPipelineRun[] }) {
  const ordered = runs.slice().reverse(); // newest first
  if (!ordered.length) {
    return <p className="muted text-[12px]">No pipeline runs in the simulation yet.</p>;
  }
  return (
    <div className="space-y-4">
      {ordered.map((run, i) => (
        <div key={run.id} className="relative pl-7 tl-fade" style={{ animationDelay: `${i * 70}ms` }}>
          <span className={`absolute -left-px top-2 dot ${dotClass(run.status)}`} aria-hidden />
          <div className="flex items-baseline gap-2">
            <span className={`status-chip ${chipClass(run.status)}`}>{run.status}</span>
            <span className="num text-[12px] muted">#{run.runId}</span>
          </div>
          <div className="muted text-[11px]">{run.workflow} &middot; {fmtWhen(run.updatedAt)}</div>
        </div>
      ))}
    </div>
  );
}

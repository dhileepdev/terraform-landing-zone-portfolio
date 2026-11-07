type PipelineRun = {
  status: string;
  workflow: string;
  runId: number;
  updatedAt: string;
};

export default function PipelineStatus({ run }: { run: PipelineRun }) {
  const statusTone =
    run.status === "success" ? "text-[#2e7d32]" : run.status === "failure" || run.status === "cancelled" ? "text-[#c4242a]" : "text-[#0a0a0a]";

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className={`num text-xl font-600 ${statusTone}`}>{run.status}</span>
        <span className="num text-[12px] muted">#{run.runId}</span>
      </div>
      <div className="muted text-[12px]">{run.workflow}</div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="muted text-[11px]">Updated:</span>
        <span className="num text-[12px]">{run.updatedAt}</span>
      </div>
    </div>
  );
}

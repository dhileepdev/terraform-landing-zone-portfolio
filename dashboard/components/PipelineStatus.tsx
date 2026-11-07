type PipelineRun = {
  status: string;
  workflow: string;
  runId: number;
  updatedAt: string;
};

export default function PipelineStatus({ run }: { run: PipelineRun }) {
  const statusColor =
    run.status === "success"
      ? "text-green-600 bg-green-50"
      : run.status === "failure" || run.status === "cancelled"
        ? "text-red-600 bg-red-50"
        : "text-yellow-600 bg-yellow-50";

  return (
    <div className="bg-white p-4 rounded shadow border">
      <h2 className="font-semibold mb-2">Pipeline</h2>
      <p className={`text-sm font-medium ${statusColor}`}>{run.status}</p>
      <p className="text-xs text-gray-500">{run.workflow}</p>
      <p className="text-xs text-gray-500">#{run.runId} • {run.updatedAt}</p>
    </div>
  );
}

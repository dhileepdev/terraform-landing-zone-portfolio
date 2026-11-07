import { getState } from "@/lib/blob";

type PipelineRun = {
  status: string;
  workflow: string;
  runId: number;
  updatedAt: string;
};

const EMPTY: PipelineRun = {
  status: "unknown",
  workflow: "—",
  runId: 0,
  updatedAt: "—",
};

export async function GET(_request: Request) {
  try {
    const token = process.env.GITHUB_PAT;
    const res = await fetch(
      "https://api.github.com/repos/owner/repo/actions/runs?per_page=1",
      {
        headers: token
          ? { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
          : { Accept: "application/vnd.github+json" },
        cache: "no-store",
      }
    );

    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);

    const data = await res.json();
    const latest = data.workflow_runs?.[0];

    return Response.json({
      status: latest?.status ?? "unknown",
      workflow: latest?.name ?? "—",
      runId: latest?.id ?? 0,
      updatedAt: latest?.updated_at ?? "—",
    });
  } catch {
    const fallback = (await getState<PipelineRun>(EMPTY)) ?? EMPTY;
    return Response.json(fallback, { status: 503 });
  }
}

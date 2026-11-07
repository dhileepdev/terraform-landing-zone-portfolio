import { getState } from "@/lib/blob";
import PipelineStatus from "@/components/PipelineStatus";
import DriftStatus from "@/components/DriftStatus";
import CostCard from "@/components/CostCard";

type DashboardState = {
  pipeline: { status: string; workflow: string; runId: number; updatedAt: string } | null;
  drift: { driftDetected: boolean; changedResources: any[]; lastChecked: string } | null;
  cost: { currentMonthSpend: number; trend: string; topService: string; lastChecked: string } | null;
};

const EMPTY: DashboardState = {
  pipeline: null,
  drift: null,
  cost: null,
};

export default async function Page() {
  const state = (await getState<DashboardState>(EMPTY)) ?? EMPTY;

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Terraform Landing Zone Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <PipelineStatus
          run={{
            status: state.pipeline?.status ?? "unknown",
            workflow: state.pipeline?.workflow ?? "—",
            runId: state.pipeline?.runId ?? 0,
            updatedAt: state.pipeline?.updatedAt ?? "—",
          }}
        />
        <DriftStatus
          drift={{
            driftDetected: state.drift?.driftDetected ?? false,
            changedResources: state.drift?.changedResources ?? [],
            lastChecked: state.drift?.lastChecked ?? "—",
          }}
        />
        <CostCard
          cost={{
            currentMonthSpend: state.cost?.currentMonthSpend ?? 0,
            trend: state.cost?.trend ?? "no data",
            topService: state.cost?.topService ?? "—",
            lastChecked: state.cost?.lastChecked ?? "—",
          }}
        />
      </div>
    </main>
  );
}

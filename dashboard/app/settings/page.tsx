type SourceRowProps = {
  name: string;
  what: string;
  source: string;
  fallback: string;
};

function SourceRow({ name, what, source, fallback }: SourceRowProps) {
  return (
    <li className="flex flex-col gap-0.5 py-3 border-b border-[var(--rule)] last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-medium text-[var(--text)]">{name}</span>
        <span className="text-[11px] text-[var(--muted)]">{what}</span>
      </div>
      <div className="text-[12px]">{source}</div>
      <div className="text-[11px] text-[var(--muted)]">{fallback}</div>
    </li>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-[12px]">
      <h1 className="text-[#0a0a0a]">Settings</h1>

      <div className="section">
        <div className="section-head">
          <span className="section-title">Data sources</span>
        </div>
        <p className="muted text-[12px] mb-3">
          The dashboard is built from these sources — nothing here is a plugin
          to install; they are the data behind the Trends, Pipeline, Drift, and
          Cost pages.
        </p>
        <ul className="list-none flex flex-col">
          <SourceRow
            name="Landing-zone trends"
            what="/api/trends — used by the Trends page"
            source="Floci emulator — bucket portfolio-dashboard-state, key sim/trends.json (FLOCI_ENDPOINT, default http://localhost:4566)"
            fallback="Vercel Blob — dashboard-trends.json, else the seeded generator"
          />
          <SourceRow
            name="Cloud cost"
            what="/api/cost — used by the Cost page"
            source="AWS Cost Explorer — GetCostAndUsage (us-east-1, demo/unsigned fetch)"
            fallback="Vercel Blob — dashboard-state.json via getState"
          />
          <SourceRow
            name="Drift"
            what="/api/drift — used by the Drift page"
            source="GitHub raw — drift/last-run.json (DRIFT_JSON_URL, or https://raw.githubusercontent.com/<GITHUB_REPOSITORY>/main/drift/last-run.json)"
            fallback="Vercel Blob — dashboard-state.json via getState"
          />
          <SourceRow
            name="Pipeline"
            what="/api/pipeline — used by the Pipeline page"
            source="GitHub Actions API — api.github.com/repos/owner/repo/actions/runs?per_page=1 (GITHUB_PAT optional)"
            fallback="Vercel Blob — dashboard-state.json via getState"
          />
        </ul>
      </div>
    </div>
  );
}

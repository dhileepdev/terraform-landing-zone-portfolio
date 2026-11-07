import { getState } from "@/lib/blob";

type CostData = {
  currentMonthSpend: number;
  trend: string;
  topService: string;
  lastChecked: string;
};

const EMPTY: CostData = {
  currentMonthSpend: 0,
  trend: "no data",
  topService: "—",
  lastChecked: "—",
};

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const end = now.toISOString().split("T")[0];
  return { start, end };
}

export async function GET(_request: Request) {
  try {
    const { start, end } = monthBounds();

    // NOTE: Real AWS Cost Explorer calls require SigV4 signing.
    // For local dev/demo without credentials, this falls back to Blob state.
    // To wire to live AWS, install @aws-sdk/client-cost-explorer and replace
    // this fetch with a signed CostExplorerClient call.
    const res = await fetch("https://ce.us-east-1.amazonaws.com/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSInsightsIndexService.GetCostAndUsage",
      },
      body: JSON.stringify({
        TimePeriod: { Start: start, End: end },
        Granularity: "MONTHLY",
        Metrics: ["BlendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      }),
    });

    if (!res.ok) throw new Error(`Cost Explorer: ${res.status}`);

    const data = await res.json();
    const results = data.ResultsByTime ?? [];

    if (results.length === 0) throw new Error("no cost data");

    const current = results[results.length - 1];
    let currentMonthSpend = 0;
    let topService = "";
    let topServiceCost = 0;

    for (const group of current.Groups ?? []) {
      const cost = parseFloat(group.Metrics.BlendedCost.Amount) || 0;
      currentMonthSpend += cost;
      if (cost > topServiceCost) {
        topServiceCost = cost;
        topService = group.Keys[0];
      }
    }

    let trend = "no data";
    const previous = results[results.length - 2];
    if (previous) {
      const prevSpend = (previous.Groups ?? []).reduce(
        (sum: number, g: any) => sum + (parseFloat(g.Metrics.BlendedCost.Amount) || 0),
        0
      );
      if (prevSpend > 0) {
        const pct = ((currentMonthSpend - prevSpend) / prevSpend) * 100;
        trend = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
      }
    }

    return Response.json({
      currentMonthSpend,
      trend,
      topService,
      lastChecked: new Date().toISOString(),
    });
  } catch {
    const fallback = (await getState<CostData>(EMPTY)) ?? EMPTY;
    return Response.json(fallback, { status: 503 });
  }
}

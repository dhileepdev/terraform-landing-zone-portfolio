import { getTrends } from "@/lib/trends-state";

export async function GET() {
  const trends = await getTrends();
  return Response.json(trends);
}

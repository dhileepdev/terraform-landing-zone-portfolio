/// <reference types="vitest/globals" />
import { GET } from "./route";

const mockRequest = new Request("http://localhost/api/cost");

const mockFetch = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  mockFetch.mockReset();
});

it("returns current month cost summary", async () => {
  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        ResultsByTime: [
          {
            TimePeriod: { Start: "2026-11-01", End: "2026-11-07" },
            Groups: [
              {
                Keys: ["AmazonEC2"],
                Metrics: { BlendedCost: { Amount: "150.00", Unit: "USD" } },
              },
              {
                Keys: ["AmazonS3"],
                Metrics: { BlendedCost: { Amount: "25.00", Unit: "USD" } },
              },
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  );

  const res = await GET(mockRequest);
  const json = await res.json();
  expect(json.currentMonthSpend).toBeDefined();
  expect(json.currentMonthSpend).toBe(175.0);
});

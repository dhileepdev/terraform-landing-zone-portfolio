/// <reference types="vitest/globals" />
import { GET } from "./route";

const mockRequest = new Request("http://localhost/api/drift");

const mockFetch = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  mockFetch.mockReset();
});

it("returns drift status from drift/last-run.json", async () => {
  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        driftDetected: false,
        changedResources: [],
        last_checked: "2026-11-07T10:00:00Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  );

  const res = await GET(mockRequest);
  const json = await res.json();
  expect(json.driftDetected).toBe(false);
});

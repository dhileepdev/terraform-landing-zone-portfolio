/// <reference types="vitest/globals" />
import { GET } from "./route";

const mockRequest = new Request("http://localhost/api/pipeline");

const mockFetch = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  mockFetch.mockReset();
});

it("returns latest workflow run status", async () => {
  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        workflow_runs: [
          {
            status: "success",
            name: "Terraform CI/CD",
            id: 42,
            updated_at: "2026-11-07T10:00:00Z",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  );

  const res = await GET(mockRequest);
  const json = await res.json();
  expect(json.status).toBe("success");
  expect(json.workflow).toBe("Terraform CI/CD");
  expect(json.runId).toBe(42);
});

// Fetches the Terraform state snapshot from the Floci S3-compatible endpoint.
// The dashboard reads the same object via plain fetch (see
// dashboard/lib/trends-state.ts), so the path-style GET below is the
// established convention for this repo.

export async function fetchState({ flociEndpoint, bucket, key }) {
  const endpoint = (flociEndpoint ?? "http://localhost:4566").replace(/\/+$/, "");
  const url = `${endpoint}/${bucket}/${key}`;

  let res;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (err) {
    throw new Error(`cannot reach Floci at ${url}: ${err.message}`);
  }

  if (res.status === 404) return null; // no state object stored yet
  if (!res.ok) throw new Error(`Floci returned ${res.status} for ${url}`);

  try {
    return await res.json();
  } catch (err) {
    throw new Error(`Floci returned an unreadable state body at ${url}: ${err.message}`);
  }
}

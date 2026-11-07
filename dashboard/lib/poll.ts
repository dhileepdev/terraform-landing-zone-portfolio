export type PollState<T> = {
  data: T | null;
  stale: boolean;
  lastUpdated: string | null;
};

export function startPoll<T>(
  intervalMs: number,
  fetchFn: () => Promise<T>,
  onUpdate: (state: PollState<T>) => void
): () => void {
  let timer: NodeJS.Timeout | null = null;

  async function tick() {
    try {
      const data = await fetchFn();
      onUpdate({ data, stale: false, lastUpdated: new Date().toISOString() });
    } catch {
      onUpdate({ data: null, stale: true, lastUpdated: null });
    }
  }

  tick();
  timer = setInterval(tick, intervalMs);
  return () => {
    if (timer) clearInterval(timer);
  };
}

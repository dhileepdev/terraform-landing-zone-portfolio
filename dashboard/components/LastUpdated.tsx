export default function LastUpdated({ timestamp }: { timestamp: string | null }) {
  return (
    <div className="muted text-[11px]">
      {timestamp ? `Last updated: ${new Date(timestamp).toLocaleString()}` : "Last updated: —"}
    </div>
  );
}

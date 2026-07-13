export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-6 w-48 rounded bg-border" />
      <div className="grid grid-cols-2 gap-3">
        <div className="card h-20" />
        <div className="card h-20" />
      </div>
      <div className="card h-24" />
      <div className="card h-40" />
    </div>
  );
}

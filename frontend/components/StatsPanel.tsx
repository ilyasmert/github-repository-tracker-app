"use client";

import { useStats } from "@/lib/hooks/useStats";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-7 w-20 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

export function StatsPanel() {
  const { data, isPending, isError, refetch } = useStats();

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>Could not load stats.</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard label="Tracked" value={data.total.toLocaleString()} />
      <StatCard label="Total stars" value={data.total_stars.toLocaleString()} />
      <StatCard label="Top language" value={data.top_language ?? "—"} />
    </div>
  );
}
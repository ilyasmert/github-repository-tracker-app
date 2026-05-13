"use client";

import { useSearchParams } from "next/navigation";

import { useRepos } from "@/lib/hooks/useRepos";
import { parseRepoFilters } from "@/lib/url/repoFilters";

import { RepoRow } from "./RepoRow";

function RowSkeleton() {
  return (
    <li className="rounded-lg border border-slate-200 bg-white px-4 py-4">
      <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-slate-200" />
    </li>
  );
}

export function RepoList() {
  const searchParams = useSearchParams();
  const filters = parseRepoFilters(searchParams);
  const hasFilters = Boolean(filters.language);
  const { data, isPending, isError, refetch } = useRepos(filters);

  if (isPending) {
    return (
      <ul className="space-y-2">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </ul>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>Could not load repositories.</span>
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

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
        {hasFilters
          ? "No repositories match the current filters."
          : "No repositories tracked yet. Add one to get started."}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {data.map((repo) => (
        <RepoRow key={repo.id} repo={repo} />
      ))}
    </ul>
  );
}
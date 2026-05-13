"use client";

import type { TrackedRepo } from "@/lib/api/types";

function formatFetchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RepoRow({ repo }: { repo: TrackedRepo }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-base font-semibold text-slate-900 hover:underline"
          >
            {repo.name}
          </a>
          <span className="ml-2 text-sm text-slate-500">by {repo.owner}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-slate-600">
          <span className="tabular-nums" title="Stars">
            ★ {repo.stars.toLocaleString()}
          </span>
          {repo.language ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {repo.language}
            </span>
          ) : null}
        </div>
      </div>

      {repo.description ? (
        <p className="mt-2 text-sm text-slate-700">{repo.description}</p>
      ) : (
        <p className="mt-2 text-sm italic text-slate-400">No description.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-500">
        <a
          href={repo.html_url}
          target="_blank"
          rel="noreferrer noopener"
          className="hover:underline"
        >
          {repo.full_name} ↗
        </a>
        <span title={repo.fetched_at}>
          Last fetched {formatFetchedAt(repo.fetched_at)}
        </span>
      </div>
    </li>
  );
}
import { Suspense } from "react";

import { FiltersBar } from "@/components/FiltersBar";
import { RepoList } from "@/components/RepoList";
import { StatsPanel } from "@/components/StatsPanel";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section aria-labelledby="stats-heading">
        <h2
          id="stats-heading"
          className="text-sm font-medium uppercase tracking-wide text-slate-500"
        >
          Stats
        </h2>
        <div className="mt-2">
          <StatsPanel />
        </div>
      </section>

      <section aria-labelledby="add-heading">
        <h2
          id="add-heading"
          className="text-sm font-medium uppercase tracking-wide text-slate-500"
        >
          Add a repository
        </h2>
        <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
          Add form will render here.
        </div>
      </section>

      <section aria-labelledby="list-heading" className="space-y-3">
        <h2
          id="list-heading"
          className="text-sm font-medium uppercase tracking-wide text-slate-500"
        >
          Tracked repositories
        </h2>
        <Suspense fallback={null}>
          <FiltersBar />
        </Suspense>
        <Suspense fallback={null}>
          <RepoList />
        </Suspense>
      </section>
    </div>
  );
}
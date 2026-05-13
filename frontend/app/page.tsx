import { Suspense } from "react";

import { AddRepoForm } from "@/components/AddRepoForm";
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
        <div className="mt-2">
          <AddRepoForm />
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
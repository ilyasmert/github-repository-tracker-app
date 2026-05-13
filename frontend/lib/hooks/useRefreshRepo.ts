"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { refreshRepo } from "@/lib/api/repos";
import type { TrackedRepo } from "@/lib/api/types";

import { queryKeys } from "./queryKeys";

export function useRefreshRepo() {
  const qc = useQueryClient();
  return useMutation<TrackedRepo, Error, number>({
    mutationFn: (id) => refreshRepo(id),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.repo(data.id), data);

      const lists = qc.getQueriesData<TrackedRepo[]>({ queryKey: ["repos"] });
      for (const [key, list] of lists) {
        if (!Array.isArray(list)) continue;
        let changed = false;
        const next = list.map((row) => {
          if (row.id !== data.id) return row;
          changed = true;
          return data;
        });
        if (changed) qc.setQueryData<TrackedRepo[]>(key, next);
      }

      void qc.invalidateQueries({ queryKey: queryKeys.stats() });
    },
  });
}
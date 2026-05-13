"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteRepo } from "@/lib/api/repos";
import type { TrackedRepo } from "@/lib/api/types";

import { queryKeys } from "./queryKeys";

type MutationContext = {
  snapshots: Array<[readonly unknown[], TrackedRepo[]]>;
};

export function useDeleteRepo() {
  const qc = useQueryClient();
  return useMutation<void, Error, number, MutationContext>({
    mutationFn: (id) => deleteRepo(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["repos"] });

      const snapshots: MutationContext["snapshots"] = [];
      const lists = qc.getQueriesData<TrackedRepo[]>({ queryKey: ["repos"] });
      for (const [key, data] of lists) {
        if (!Array.isArray(data)) continue;
        const next = data.filter((row) => row.id !== id);
        if (next.length !== data.length) {
          snapshots.push([key, data]);
          qc.setQueryData<TrackedRepo[]>(key, next);
        }
      }

      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.snapshots) {
        qc.setQueryData<TrackedRepo[]>(key, data);
      }
    },
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.repo(id) });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["repos"] });
      void qc.invalidateQueries({ queryKey: queryKeys.stats() });
    },
  });
}
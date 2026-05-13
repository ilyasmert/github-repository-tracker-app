"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateRepoNotes } from "@/lib/api/repos";
import type { TrackedRepo } from "@/lib/api/types";

import { queryKeys } from "./queryKeys";

export type UpdateNotesVariables = {
  id: number;
  notes: string;
};

type RepoListSnapshot = {
  key: readonly unknown[];
  data: TrackedRepo[];
}[];

type MutationContext = {
  previousLists: RepoListSnapshot;
  previousRepo: TrackedRepo | undefined;
};

export function useUpdateNotes() {
  const qc = useQueryClient();
  return useMutation<TrackedRepo, Error, UpdateNotesVariables, MutationContext>({
    mutationFn: ({ id, notes }) => updateRepoNotes(id, { notes }),
    onMutate: async ({ id, notes }) => {
      await qc.cancelQueries({ queryKey: ["repos"] });
      await qc.cancelQueries({ queryKey: queryKeys.repo(id) });

      const previousLists = qc
        .getQueriesData<TrackedRepo[]>({ queryKey: ["repos"] })
        .filter((entry): entry is [readonly unknown[], TrackedRepo[]] => {
          return Array.isArray(entry[1]);
        })
        .map(([key, data]) => ({ key, data }));

      for (const { key, data } of previousLists) {
        qc.setQueryData<TrackedRepo[]>(
          key,
          data.map((row) => (row.id === id ? { ...row, notes } : row)),
        );
      }

      const previousRepo = qc.getQueryData<TrackedRepo>(queryKeys.repo(id));
      if (previousRepo) {
        qc.setQueryData<TrackedRepo>(queryKeys.repo(id), {
          ...previousRepo,
          notes,
        });
      }

      return { previousLists, previousRepo };
    },
    onError: (_err, { id }, ctx) => {
      if (!ctx) return;
      for (const { key, data } of ctx.previousLists) {
        qc.setQueryData<TrackedRepo[]>(key, data);
      }
      if (ctx.previousRepo) {
        qc.setQueryData<TrackedRepo>(queryKeys.repo(id), ctx.previousRepo);
      }
    },
    onSettled: (_data, _err, { id }) => {
      void qc.invalidateQueries({ queryKey: ["repos"] });
      void qc.invalidateQueries({ queryKey: queryKeys.repo(id) });
    },
  });
}
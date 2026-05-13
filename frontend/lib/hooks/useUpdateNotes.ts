"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateRepoNotes } from "@/lib/api/repos";
import type { TrackedRepo } from "@/lib/api/types";

import { queryKeys } from "./queryKeys";

export type UpdateNotesVariables = {
  id: number;
  notes: string;
};

type MutationContext = {
  previousNotes: string | undefined;
};

export function useUpdateNotes() {
  const qc = useQueryClient();
  return useMutation<TrackedRepo, Error, UpdateNotesVariables, MutationContext>({
    mutationFn: ({ id, notes }) => updateRepoNotes(id, { notes }),
    onMutate: async ({ id, notes }) => {
      await qc.cancelQueries({ queryKey: ["repos"] });
      await qc.cancelQueries({ queryKey: queryKeys.repo(id) });

      let previousNotes: string | undefined;

      const lists = qc.getQueriesData<TrackedRepo[]>({ queryKey: ["repos"] });
      for (const [key, data] of lists) {
        if (!Array.isArray(data)) continue;
        let changed = false;
        const next = data.map((row) => {
          if (row.id !== id) return row;
          if (previousNotes === undefined) previousNotes = row.notes;
          changed = true;
          return { ...row, notes };
        });
        if (changed) qc.setQueryData<TrackedRepo[]>(key, next);
      }

      const previousRepo = qc.getQueryData<TrackedRepo>(queryKeys.repo(id));
      if (previousRepo) {
        if (previousNotes === undefined) previousNotes = previousRepo.notes;
        qc.setQueryData<TrackedRepo>(queryKeys.repo(id), {
          ...previousRepo,
          notes,
        });
      }

      return { previousNotes };
    },
    onError: (_err, { id }, ctx) => {
      if (!ctx || ctx.previousNotes === undefined) return;
      const restored = ctx.previousNotes;

      const lists = qc.getQueriesData<TrackedRepo[]>({ queryKey: ["repos"] });
      for (const [key, data] of lists) {
        if (!Array.isArray(data)) continue;
        let changed = false;
        const next = data.map((row) => {
          if (row.id !== id) return row;
          changed = true;
          return { ...row, notes: restored };
        });
        if (changed) qc.setQueryData<TrackedRepo[]>(key, next);
      }

      const currentRepo = qc.getQueryData<TrackedRepo>(queryKeys.repo(id));
      if (currentRepo) {
        qc.setQueryData<TrackedRepo>(queryKeys.repo(id), {
          ...currentRepo,
          notes: restored,
        });
      }
    },
    onSettled: (_data, _err, { id }) => {
      void qc.invalidateQueries({ queryKey: ["repos"] });
      void qc.invalidateQueries({ queryKey: queryKeys.repo(id) });
    },
  });
}
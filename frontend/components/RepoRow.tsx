"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import type { TrackedRepo } from "@/lib/api/types";
import { useDeleteRepo } from "@/lib/hooks/useDeleteRepo";
import { useRefreshRepo } from "@/lib/hooks/useRefreshRepo";
import { useUpdateNotes } from "@/lib/hooks/useUpdateNotes";

import { ConfirmDialog } from "./ConfirmDialog";
import { Toast } from "./Toast";

const NOTES_MAX = 2000;

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

function messageForNotesError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "NOT_FOUND":
        return "This repository no longer exists. Refresh the list.";
      case "VALIDATION":
        return err.message || "Notes are invalid.";
      default:
        return err.message || "Could not save notes. Please try again.";
    }
  }
  return "Could not save notes. Please try again.";
}

function messageForRefreshError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "NOT_FOUND":
        return "This repository no longer exists.";
      case "GITHUB_NOT_FOUND":
        return "GitHub no longer has this repository.";
      case "GITHUB_RATE_LIMITED":
        return "GitHub rate limit reached. Try again in a few minutes.";
      case "UPSTREAM":
        return "GitHub is having trouble responding. Try again shortly.";
      default:
        return err.message || "Could not refresh. Please try again.";
    }
  }
  return "Could not refresh. Please try again.";
}

function messageForDeleteError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "NOT_FOUND":
        return "This repository was already removed.";
      default:
        return err.message || "Could not delete. Please try again.";
    }
  }
  return "Could not delete. Please try again.";
}

export function RepoRow({ repo }: { repo: TrackedRepo }) {
  const notesMutation = useUpdateNotes();
  const refreshMutation = useRefreshRepo();
  const deleteMutation = useDeleteRepo();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(repo.notes);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(repo.notes);
  }, [editing, repo.notes]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast])

  const saving = notesMutation.isPending;
  const refreshing = refreshMutation.isPending;
  const deleting = deleteMutation.isPending;
  const notesError = notesMutation.error
    ? messageForNotesError(notesMutation.error)
    : null;
  const refreshError = refreshMutation.error
    ? messageForRefreshError(refreshMutation.error)
    : null;
  const deleteError = deleteMutation.error
    ? messageForDeleteError(deleteMutation.error)
    : null;

  function startEditing() {
    notesMutation.reset();
    setDraft(repo.notes);
    setEditing(true);
  }

  function cancelEditing() {
    if (saving) return;
    notesMutation.reset();
    setDraft(repo.notes);
    setEditing(false);
  }

  async function saveEditing() {
    const next = draft.trim();
    if (next === repo.notes.trim()) {
      setEditing(false);
      return;
    }
    try {
      await notesMutation.mutateAsync({ id: repo.id, notes: next });
      setEditing(false);
    } catch {
      /* error surfaced via mutation.error; stay in edit mode */
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void saveEditing();
    }
  }

  function onRefresh() {
    refreshMutation.reset();
    refreshMutation.mutate(repo.id, {
      onSuccess: () => setToast({message: "successful", type: "success"}),
      onError: (err) => setToast({message: "err", type: "error"})
    });
  }

  function openDeleteConfirm() {
    deleteMutation.reset();
    setConfirmingDelete(true);
  }

  function closeDeleteConfirm() {
    if (deleting) return;
    setConfirmingDelete(false);
  }

  async function confirmDelete() {
    try {
      await deleteMutation.mutateAsync(repo.id);
      setConfirmingDelete(false);
    } catch {
      /* error surfaced via deleteMutation.error; keep dialog open */
    }
  }

  return (
    <li
      aria-busy={refreshing || deleting}
      className="rounded-lg border border-slate-200 bg-white px-4 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded text-base font-semibold text-slate-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1"
          >
            {repo.name}
          </a>
          <span className="ml-2 text-sm text-slate-500">by {repo.owner}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-slate-600">
          {saving ? (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500"
            >
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"
              />
              Saving…
            </span>
          ) : null}
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

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`repo-notes-${repo.id}`}
            className="text-xs font-medium text-slate-600"
          >
            Notes
          </label>
          {!editing ? (
            <button
              type="button"
              onClick={startEditing}
              className="rounded text-xs font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1"
            >
              {repo.notes ? "Edit" : "Add notes"}
            </button>
          ) : null}
        </div>

        {editing ? (
          <div className="mt-1">
            <textarea
              id={`repo-notes-${repo.id}`}
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={saving}
              maxLength={NOTES_MAX}
              rows={3}
              aria-invalid={notesError ? "true" : "false"}
              aria-describedby={
                notesError ? `repo-notes-${repo.id}-error` : undefined
              }
              className="w-full resize-y rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="Add notes about this repository…"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                {draft.length}/{NOTES_MAX} · ⌘/Ctrl+Enter to save · Esc to
                cancel
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveEditing()}
                  disabled={saving}
                  className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : repo.notes ? (
          <p
            id={`repo-notes-${repo.id}`}
            className="mt-1 whitespace-pre-wrap text-sm text-slate-700"
          >
            {repo.notes}
          </p>
        ) : (
          <p
            id={`repo-notes-${repo.id}`}
            className="mt-1 text-sm italic text-slate-400"
          >
            No notes yet.
          </p>
        )}

        {notesError ? (
          <p
            id={`repo-notes-${repo.id}-error`}
            role="alert"
            aria-live="polite"
            className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700"
          >
            {notesError}
          </p>
        ) : null}
      </div>

      {refreshError ? (
        <p
          role="alert"
          aria-live="polite"
          className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700"
        >
          {refreshError}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-slate-500">
        <a
          href={repo.html_url}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1"
        >
          {repo.full_name} ↗
        </a>
        <div className="flex items-center gap-2">
          <span title={repo.fetched_at}>
            Last fetched {formatFetchedAt(repo.fetched_at)}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || deleting}
            aria-label={`Refresh ${repo.full_name}`}
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? (
              <>
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"
                />
                Refreshing…
              </>
            ) : (
              "Refresh"
            )}
          </button>
          <button
            type="button"
            onClick={openDeleteConfirm}
            disabled={refreshing || deleting}
            aria-label={`Delete ${repo.full_name}`}
            className="rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete repository?"
        description={`This will remove ${repo.full_name} from your tracked list. This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={closeDeleteConfirm}
      />
    </li>
  );
}

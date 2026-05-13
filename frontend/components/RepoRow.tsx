"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import type { TrackedRepo } from "@/lib/api/types";
import { useUpdateNotes } from "@/lib/hooks/useUpdateNotes";

const NOTES_MAX = 1000;

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

export function RepoRow({ repo }: { repo: TrackedRepo }) {
  const mutation = useUpdateNotes();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(repo.notes);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(repo.notes);
  }, [editing, repo.notes]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const saving = mutation.isPending;
  const apiError = mutation.error ? messageForNotesError(mutation.error) : null;

  function startEditing() {
    mutation.reset();
    setDraft(repo.notes);
    setEditing(true);
  }

  function cancelEditing() {
    if (saving) return;
    mutation.reset();
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
      await mutation.mutateAsync({ id: repo.id, notes: next });
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
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
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
              aria-invalid={apiError ? "true" : "false"}
              aria-describedby={apiError ? `repo-notes-${repo.id}-error` : undefined}
              className="w-full resize-y rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="Add notes about this repository…"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                {draft.length}/{NOTES_MAX} · ⌘/Ctrl+Enter to save · Esc to cancel
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveEditing()}
                  disabled={saving}
                  className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
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

        {apiError ? (
          <p
            id={`repo-notes-${repo.id}-error`}
            role="alert"
            aria-live="polite"
            className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700"
          >
            {apiError}
          </p>
        ) : null}
      </div>

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
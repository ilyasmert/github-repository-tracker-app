"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { useCreateRepo } from "@/lib/hooks/useCreateRepo";

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const schema = z.object({
  owner: z
    .string()
    .trim()
    .min(1, "Required")
    .max(100, "Too long (100 max)")
    .regex(SEGMENT, "Letters, digits, '.', '_' or '-'; must start alphanumeric"),
  name: z
    .string()
    .trim()
    .min(1, "Required")
    .max(100, "Too long (100 max)")
    .regex(SEGMENT, "Letters, digits, '.', '_' or '-'; must start alphanumeric"),
});

type FormValues = z.infer<typeof schema>;

function messageForError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "DUPLICATE":
        return "That repository is already on your watchlist.";
      case "GITHUB_NOT_FOUND":
        return "We couldn't find that repository on GitHub. Check the owner and name.";
      case "VALIDATION":
        return err.message || "Please check the inputs and try again.";
      case "GITHUB_RATE_LIMITED":
        return "GitHub rate limit reached. Try again in a few minutes.";
      case "UPSTREAM":
        return "GitHub is having trouble responding. Try again shortly.";
      default:
        return err.message || "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}

export function AddRepoForm() {
  const mutation = useCreateRepo();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { owner: "", name: "" },
  });

  const submitting = isSubmitting || mutation.isPending;
  const apiError = mutation.error ? messageForError(mutation.error) : null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
      reset();
    } catch {
      /* surfaced via mutation.error */
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label
            htmlFor="repo-owner"
            className="block text-xs font-medium text-slate-600"
          >
            Owner
          </label>
          <input
            id="repo-owner"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. golang"
            aria-invalid={errors.owner ? "true" : "false"}
            aria-describedby={errors.owner ? "repo-owner-error" : undefined}
            disabled={submitting}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            {...register("owner")}
          />
          {errors.owner ? (
            <p
              id="repo-owner-error"
              role="alert"
              className="mt-1 text-xs text-red-600"
            >
              {errors.owner.message}
            </p>
          ) : null}
        </div>

        <div className="flex-1">
          <label
            htmlFor="repo-name"
            className="block text-xs font-medium text-slate-600"
          >
            Repository
          </label>
          <input
            id="repo-name"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. go"
            aria-invalid={errors.name ? "true" : "false"}
            aria-describedby={errors.name ? "repo-name-error" : undefined}
            disabled={submitting}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            {...register("name")}
          />
          {errors.name ? (
            <p
              id="repo-name-error"
              role="alert"
              className="mt-1 text-xs text-red-600"
            >
              {errors.name.message}
            </p>
          ) : null}
        </div>

        <div className="sm:pt-5">
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="inline-flex w-full items-center justify-center rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
          >
            {submitting ? (
              <>
                <span
                  aria-hidden="true"
                  className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"
                />
                Adding…
              </>
            ) : (
              "Add repository"
            )}
          </button>
        </div>
      </div>

      {apiError ? (
        <p
          role="alert"
          aria-live="polite"
          className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {apiError}
        </p>
      ) : null}
    </form>
  );
}
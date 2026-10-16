import { PlanError } from "@/lib/simulation/plan";
import { ApplyError } from "@/lib/simulation/apply";
import { PackageError } from "@/lib/packages/schema";
/** Application error types and mapping of database errors to player-facing messages. */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = "APP_ERROR",
    public readonly status: number = 400,
  ) {
    super(message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "The online service is temporarily unavailable. Your data is safe; please try again shortly.") {
    super(message, "SERVICE_UNAVAILABLE", 503);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super(message, "FORBIDDEN", 403);
  }
}

const KNOWN: Array<[RegExp, string]> = [
  [/UNIVERSE_LIMIT_REACHED/, "You have used all of your universe save slots. Archive or delete a universe, or upgrade for more slots."],
  [/RATE_LIMITED/, "You're doing that too often. Please wait a little and try again."],
  [/SHOW_ALREADY_SIMULATED/, "This show has already been simulated. Its results are shown below."],
  [/UNIVERSE_CHANGED/, "Your universe changed in another tab or the request was sent twice. Reload to see the latest state."],
  [/SHOW_VERSION_CONFLICT/, "This show was changed in another tab. Reload to see the latest card."],
  [/TITLE_ALREADY_HELD|title_reigns_current_unique/, "That championship already has a current champion. End the current reign first."],
  [/ACCOUNT_RESTRICTED/, "Your account is restricted from community activity. See Account → Status for details."],
  [/CANNOT_RATE_OWN_CREATION/, "You can't rate your own creation."],
  [/CANNOT_REPORT_OWN_CREATION/, "You can't report your own creation."],
  [/ALREADY_REPORTED/, "You've already reported this. Moderators will review it."],
  [/APPEAL_ALREADY_OPEN/, "An appeal for this creation is already under review."],
  [/CREATION_NOT_FOUND/, "That creation is not available."],
  [/CREATION_REMOVED/, "This creation was removed by moderators and can't be republished. You can submit an appeal."],
  [/PUBLISH_LIMIT_REACHED/, "You've reached your limit of active community creations. Unpublish one (it stays saved as a draft) or upgrade for more."],
  [/REMIX_NOT_ALLOWED/, "The original creator doesn't allow remixes of this creation, so it can't be published. You can still play it privately."],
  [/CATEGORY_MISMATCH/, "A new version must be the same kind of creation as the original."],
  [/NOTHING_TO_APPEAL/, "There's no moderation decision on this creation to appeal."],
  [/CANNOT_REPORT_SELF/, "You can't report yourself."],
  [/REASON_REQUIRED/, "Please give a reason (at least 3 characters)."],
  [/CANNOT_RESTRICT_SELF/, "You can't restrict your own account."],
  [/DEV_ENTITLEMENTS_DISABLED/, "Development entitlements are disabled on this server."],
  [/FORBIDDEN|42501|row-level security/, "You do not have permission to do that."],
  [/UNIVERSE_NOT_FOUND/, "Universe not found."],
  [/duplicate key value/, "That already exists."],
  [/violates check constraint/, "Some values were out of range. Please check the form."],
  [/fetch failed|ECONNREFUSED|ENOTFOUND|Failed to fetch|NetworkError/, "Couldn't reach the game server. Check your connection and try again; nothing was saved."],
];

export function errorMessage(error: unknown): string {
  if (error instanceof AppError || error instanceof PlanError || error instanceof PackageError) return error.message;
  if (error instanceof Error && error.name === "MediaValidationError") return error.message;
  if (error instanceof ApplyError) return errorMessage({ message: error.code });
  const raw =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  for (const [pattern, message] of KNOWN) if (pattern.test(raw)) return message;
  return "Something went wrong. Please try again.";
}

/** Throws a mapped AppError when a Supabase response carries an error. */
export function unwrap<T>(result: { data: T; error: { message: string; code?: string } | null }): T {
  if (result.error) {
    const err = new AppError(errorMessage(result.error), result.error.code ?? "DB_ERROR");
    (err as AppError & { cause?: unknown }).cause = result.error;
    throw err;
  }
  return result.data;
}

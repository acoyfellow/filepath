import { error, type RequestEvent } from "@sveltejs/kit";
import { Effect } from "effect";
import { getDrizzle } from "$lib/auth";
import type { User } from "better-auth";
import type { AppContext, AppError } from "./app";

export function createUserContextFromParts(user: User | null, platform?: RequestEvent["platform"]): AppContext {
  if (!user) {
    throw error(401, "Unauthorized");
  }
  return {
    db: getDrizzle(),
    userId: user.id,
    role: (user as { role?: string }).role ?? null,
  };
}

export function createUserContext(event: RequestEvent): AppContext {
  return createUserContextFromParts(event.locals.user, event.platform);
}

export async function runOrThrow<A>(program: Effect.Effect<A, AppError>): Promise<A> {
  try {
    return await Effect.runPromise(program);
  } catch (cause) {
    if (cause && typeof cause === "object" && "_tag" in cause) {
      const appError = cause as { _tag: string; message: string };
      switch (appError._tag) {
        case "Unauthorized":
          throw error(401, appError.message);
        case "Forbidden":
          throw error(403, appError.message);
        case "BadRequest":
          throw error(400, appError.message);
        case "NotFound":
          throw error(404, appError.message);
        case "Conflict":
          throw error(409, appError.message);
        case "Unavailable":
          throw error(503, appError.message);
        case "Internal":
          throw error(500, appError.message);
      }
    }

    throw error(500, "Unexpected application error");
  }
}

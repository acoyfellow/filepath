import { error, type RequestEvent } from "@sveltejs/kit";
import { Effect } from "effect";
import { getDrizzle } from "$lib/auth";
import type { User } from "better-auth";
import type { AppContext, AppError } from "./app";

function sessionEventPublisher(
  platform: RequestEvent["platform"],
): AppContext["publishSessionEvent"] {
  if (!(platform?.env && "SESSION_DO" in platform.env)) {
    return undefined;
  }

  return async (sessionId: string, payload: Record<string, unknown>) => {
    const sessionNamespace = platform.env.SESSION_DO as unknown as {
      get(id: unknown): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> };
      idFromName(name: string): unknown;
    };
    const stub = sessionNamespace.get(sessionNamespace.idFromName(sessionId));
    await stub.fetch("https://session/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };
}

export function createUserContextFromParts(user: User | null, platform?: RequestEvent["platform"]): AppContext {
  if (!user) {
    throw error(401, "Unauthorized");
  }
  return {
    db: getDrizzle(),
    userId: user.id,
    role: (user as { role?: string }).role ?? null,
    authSecret:
      platform?.env && "BETTER_AUTH_SECRET" in platform.env && typeof platform.env.BETTER_AUTH_SECRET === "string"
        ? platform.env.BETTER_AUTH_SECRET
        : undefined,
    publishSessionEvent: sessionEventPublisher(platform),
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

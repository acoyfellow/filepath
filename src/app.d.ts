import type { D1Database, DurableObjectNamespace } from "@cloudflare/workers-types";
import type { User as BetterAuthUser, Session as BetterAuthSession } from "better-auth";

type AppUser = BetterAuthUser & {
	role?: string | null;
};

declare global {
	interface Window {
		alert: (msg?: string, type?: "error" | "confirm" | "success" | "notification", autoHide?: boolean, onClose?: (() => void) | false, retainMs?: number) => void;
	}
	namespace App {
		// interface Error {}
		interface Locals {
      user: AppUser | null;
      session: BetterAuthSession | null;
    }
		// interface PageData {}
		// interface PageState {}
	interface Platform {
      env: {
        WORKER: Fetcher;
        Sandbox: DurableObjectNamespace;
        DB: D1Database;
        API_WS_HOST?: string;
        API_WS_ORIGIN?: string;
        FILEPATH_RUNTIME_PUBLIC_BASE_URL?: string;
        BETTER_AUTH_SECRET?: string;
        BETTER_AUTH_URL?: string;
				};
		}
	}
}

export {};

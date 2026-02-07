import type { D1Database } from "@cloudflare/workers-types";
import type { User as BetterAuthUser, Session as BetterAuthSession } from "better-auth";

declare global {
	interface Window {
		alert: (msg?: string, type?: "error" | "confirm" | "success" | "notification", autoHide?: boolean, onClose?: (() => void) | false, retainMs?: number) => void;
	}
	namespace App {
		// interface Error {}
		interface Locals {
      user: BetterAuthUser | null;
      session: BetterAuthSession | null;
    }
		// interface PageData {}
		// interface PageState {}
		interface Platform {
				env: {
					SESSION_DO: DurableObjectNamespace;
					WORKER: Fetcher;
					DB: D1Database;
				};
		}
	}
}

export {};

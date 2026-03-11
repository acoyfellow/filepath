import { redirect } from "@sveltejs/kit";
import type { ServerLoadEvent } from "@sveltejs/kit";

export const load = async (_event: ServerLoadEvent) => {
  throw redirect(308, "/workspace/new");
};

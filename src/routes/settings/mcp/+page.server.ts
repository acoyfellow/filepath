import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { resolveRuntimeBaseUrl } from "$lib/runtime/http";

export const load: PageServerLoad = async ({ locals, url, platform }) => {
  if (!locals.user) {
    throw redirect(302, "/login?redirect=/settings/mcp");
  }
  return {
    userId: locals.user.id,
    workerBaseUrl: resolveRuntimeBaseUrl({ url, platform }),
  };
};

import { redirect } from "@sveltejs/kit";
import type { ServerLoadEvent } from "@sveltejs/kit";

export const load = async ({ params }: ServerLoadEvent) => {
  throw redirect(308, `/workspace/${params.id}`);
};

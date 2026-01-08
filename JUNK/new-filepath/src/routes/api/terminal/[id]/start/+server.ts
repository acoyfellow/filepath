import { dev } from "$app/environment";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request, platform }) => {
  const { id } = params;

  // Proxy to worker's /simple/:id endpoint
  const endpoint = `/simple/${id}`;

  try {
    if (dev) {
      // In dev, worker runs on localhost:1337
      const res = await fetch(`http://localhost:1337${endpoint}`, {
        method: "POST",
        headers: request.headers,
        body: request.body,
      });
      return res;
    }

    // In production, use platform binding
    // Pass original hostname so exposePort works correctly
    const originalUrl = new URL(request.url);
    const workerUrl = `https://api.myfilepath.com${endpoint}`;

    return platform!.env!.WORKER.fetch(
      new Request(workerUrl, {
        method: "POST",
        headers: request.headers,
        body: request.body,
      })
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
};


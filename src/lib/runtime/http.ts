import type { RequestEvent } from "@sveltejs/kit";

export function resolveRuntimeBaseUrl(event: Pick<RequestEvent, "url" | "platform">): string {
  const hostname = event.url.hostname;
  const apiWsOrigin = event.platform?.env?.API_WS_ORIGIN;
  const apiWsHost = event.platform?.env?.API_WS_HOST;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:1337";
  }

  if (apiWsOrigin) {
    return apiWsOrigin;
  }

  if (apiWsHost) {
    return `https://${apiWsHost}`;
  }

  if (hostname === "myfilepath.com") {
    return "https://api.myfilepath.com";
  }

  return event.url.origin;
}

export async function fetchRuntime(
  event: Pick<RequestEvent, "url" | "platform">,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const service = event.platform?.env?.WORKER;

  if (service) {
    return service.fetch(`https://runtime.internal${normalizedPath}`, init);
  }

  return fetch(`${resolveRuntimeBaseUrl(event)}${normalizedPath}`, init);
}

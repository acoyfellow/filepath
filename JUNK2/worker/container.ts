import { Effect, Duration } from "effect";
import { ContainerError } from "./effects";
import { switchPort } from "@cloudflare/containers";

export interface ContainerBinding {
  fetch(request: Request): Promise<Response>;
}

export function connectWebSocket(
  container: ContainerBinding,
  sessionId: string
): Effect.Effect<WebSocket, ContainerError> {
  return Effect.gen(function* () {
    console.log("[Container] Attempting WebSocket connection to container");
    // Per README: Use switchPort to explicitly target port 7681 for WebSocket
    // Even though defaultPort is set, switchPort ensures correct routing
    const wsRequest = switchPort(new Request("http://container/ws", {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        "Sec-WebSocket-Key": btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))),
        "Sec-WebSocket-Version": "13",
      },
    }), 7681);

    console.log("[Container] Calling container.fetch() with switchPort(7681)");
    console.log("[Container] Request URL:", wsRequest.url);
    console.log("[Container] Request headers:", Object.fromEntries(wsRequest.headers.entries()));

    const response = yield* Effect.tryPromise({
      try: async () => {
        console.log("[Container] About to fetch - this will auto-start container if needed");
        const startTime = Date.now();
        const result = await container.fetch(wsRequest);
        const elapsed = Date.now() - startTime;
        console.log("[Container] Fetch completed in", elapsed, "ms");
        return result;
      },
      catch: (error) => {
        console.error("[Container] Fetch error:", error);
        return new ContainerError(
          `Failed to connect WebSocket: ${String(error)}`,
          error
        );
      },
    });

    console.log("[Container] Response status:", response.status, "has webSocket:", !!response.webSocket);

    if (response.status !== 101 || !response.webSocket) {
      yield* Effect.fail(
        new ContainerError(
          `WebSocket upgrade failed: status ${response.status}`
        )
      );
    }

    const ws = response.webSocket;
    if (!ws) {
      yield* Effect.fail(
        new ContainerError("WebSocket not present in response")
      );
    }
    return ws;
  }).pipe(
    Effect.timeout(Duration.millis(30000)) // Increase timeout - container might need to start
  ).pipe(
    Effect.flatMap((ws) => {
      if (ws === null) {
        return Effect.fail(new ContainerError("WebSocket connection timed out"));
      }
      return Effect.succeed(ws);
    })
  ).pipe(
    Effect.mapError((error) => {
      if (error._tag === "TimeoutException") {
        return new ContainerError("WebSocket connection timed out");
      }
      return error as ContainerError;
    })
  );
}


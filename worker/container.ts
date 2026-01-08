import { Effect, Duration } from "effect";
import { ContainerError } from "./effects";

export interface ContainerBinding {
  fetch(request: Request): Promise<Response>;
}

export function connectWebSocket(
  container: ContainerBinding,
  sessionId: string
): Effect.Effect<WebSocket, ContainerError> {
  return Effect.gen(function* () {
    console.log("[Container] Attempting WebSocket connection to container");
    // Container binding automatically routes to the container
    // Alchemy container binding expects the full URL with port
    const wsRequest = new Request("http://container:7681/ws", {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        "Sec-WebSocket-Key": btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))),
        "Sec-WebSocket-Version": "13",
      },
    });

    console.log("[Container] Calling container.fetch()");
    const response = yield* Effect.tryPromise({
      try: () => {
        console.log("[Container] About to fetch");
        return container.fetch(wsRequest);
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
    Effect.timeout(Duration.millis(10000))
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


// wrangler-harness
// src/index.ts
//
// Effect-first Cloudflare E2E "gate" harness.
// - Stimulus: exec commands + optional Playwright browser visit
// - Observability: `wrangler tail --format json`
// - Proof: assertions over structured logs (+ optional browser diagnostics)
// - Stop: idle/max timeout
//
// Design goals:
// - AX > DX: machine-shaped result, deterministic failure surface, human-readable optional reporter.
// - Runs anywhere: local CLI, scripts, CI/CD (as long as wrangler is auth'd).
//
// Minimal usage:
//   import { Gate, Act, Observe, Assert, Stop, Report } from "wrangler-harness";
//   const gate = Gate.define({
//     name: "deploy+smoke",
//     target: { accountId: process.env.CLOUDFLARE_ACCOUNT_ID, workerName: "terminal-app" },
//     act: Act.sequence([
//       Act.exec("wrangler deploy"),
//       Act.browser({ url: "https://terminal-app.example.workers.dev/", headless: true, waitMs: 5000 })
//     ]),
//     observe: Observe.wranglerTail({}),
//     assert: [Assert.noTaggedErrors(), Assert.requiredActions(["request_received"])],
//     stop: Stop.whenIdle({ idleMs: 3000, maxMs: 15000 }),
//     report: Report.json({ pretty: true })
//   });
//   const res = await Gate.run(gate);
//   if (res.status !== "success") process.exit(1);

import { spawn } from "node:child_process";
import { Effect, Queue, Ref, Schema, Either } from "effect";

/* ---------------------------------- Domain ---------------------------------- */

export type Stage = "worker" | "durable_object" | "container";

export type StructuredLog = {
  requestId?: string;
  timestamp?: string;
  stage?: Stage;
  action?: string;
  status?: "start" | "success" | "error" | "info";
  durableObjectId?: string;
  containerId?: string;
  error?: { tag: string; message: string; stack?: string };
  data?: Record<string, unknown>;
  durationMs?: number;
  [k: string]: unknown;
};

export type Evidence = {
  url?: string;
  requestIds: string[];
  stagesSeen: Stage[];
  actionsSeen: string[];
  errorTags: string[];
  browser?: {
    consoleErrors: string[];
    networkFailures: string[];
  };
};

export type HarnessResult =
  | { status: "success"; durationMs: number; logs: StructuredLog[]; evidence: Evidence }
  | { status: "failed"; durationMs: number; logs: StructuredLog[]; evidence: Evidence; error: HarnessError }
  | { status: "timeout"; durationMs: number; logs: StructuredLog[]; evidence: Evidence; error: HarnessError };

/* ---------------------------------- Errors ---------------------------------- */

export class ObservabilityError extends Schema.TaggedError<ObservabilityError>()(
  "ObservabilityError",
  { cause: Schema.Unknown }
) {}

export class ExecError extends Schema.TaggedError<ExecError>()("ExecError", {
  command: Schema.String,
  code: Schema.Number,
  stderr: Schema.String
}) {}

export class BrowserError extends Schema.TaggedError<BrowserError>()("BrowserError", {
  action: Schema.String,
  cause: Schema.Unknown
}) {}

export class AssertionFailed extends Schema.TaggedError<AssertionFailed>()("AssertionFailed", {
  assertion: Schema.String,
  details: Schema.Unknown
}) {}

export class LogTimeoutError extends Schema.TaggedError<LogTimeoutError>()("LogTimeoutError", {
  maxMs: Schema.Number,
  idleMs: Schema.Number
}) {}

export type HarnessError =
  | ObservabilityError
  | ExecError
  | BrowserError
  | AssertionFailed
  | LogTimeoutError;

/* --------------------------------- Helpers ---------------------------------- */

function parseLogLine(line: string): StructuredLog | null {
  try {
    const parsed = JSON.parse(line);
    if (!parsed || typeof parsed !== "object") return null;

    // Wrangler JSON logs often place inner JSON inside `message` as a string.
    const msg = (parsed as any).message;
    if (typeof msg === "string") {
      try {
        const inner = JSON.parse(msg);
        if (inner && typeof inner === "object") return { ...(parsed as any), ...(inner as any) };
      } catch {
        // ignore
      }
    }

    return parsed as StructuredLog;
  } catch {
    return null;
  }
}

function summarize(logs: StructuredLog[], browser?: Evidence["browser"]): Evidence {
  const requestIds = new Set<string>();
  const stages = new Set<Stage>();
  const actions = new Set<string>();
  const errorTags = new Set<string>();

  for (const l of logs) {
    if (l.requestId) requestIds.add(l.requestId);
    if (l.stage) stages.add(l.stage);
    if (l.action) actions.add(l.action);

    if (l.error?.tag) errorTags.add(l.error.tag);
    if (l.status === "error") errorTags.add("ErrorStatus");
  }

  return {
    requestIds: [...requestIds],
    stagesSeen: [...stages],
    actionsSeen: [...actions],
    errorTags: [...errorTags],
    browser
  };
}

/* ---------------------------------- Observe --------------------------------- */

export namespace Observe {
  export type Backend =
    | { _tag: "CliStream"; accountId?: string }
    | {
        _tag: "AnalyticsEngine";
        accountId: string;
        apiToken: string;
        dataset: string;
        pollInterval?: number; // ms, default 500
      }
    | {
        _tag: "WorkersLogs";
        accountId: string;
        apiToken: string;
        workerName: string;
        pollInterval?: number;
      }
    | {
        _tag: "CustomEndpoint";
        url: string;
        headers?: Record<string, string>;
      }
    | {
        _tag: "Local";
        logs?: StructuredLog[];
      }
    | {
        _tag: "Hybrid";
        backends: Backend[];
      };

  export const cliStream = (opts?: { accountId?: string }): Backend => ({
    _tag: "CliStream",
    accountId: opts?.accountId
  });

  export const analyticsEngine = (opts: {
    accountId: string;
    apiToken: string;
    dataset: string;
    pollInterval?: number;
  }): Backend => ({
    _tag: "AnalyticsEngine",
    accountId: opts.accountId,
    apiToken: opts.apiToken,
    dataset: opts.dataset,
    pollInterval: opts.pollInterval ?? 500
  });

  export const workersLogs = (opts: {
    accountId: string;
    apiToken: string;
    workerName: string;
    pollInterval?: number;
  }): Backend => ({
    _tag: "WorkersLogs",
    accountId: opts.accountId,
    apiToken: opts.apiToken,
    workerName: opts.workerName,
    pollInterval: opts.pollInterval ?? 1000
  });

  export const customEndpoint = (opts: {
    url: string;
    headers?: Record<string, string>;
  }): Backend => ({
    _tag: "CustomEndpoint",
    url: opts.url,
    headers: opts.headers
  });

  export const local = (opts?: { logs?: StructuredLog[] }): Backend => ({
    _tag: "Local",
    logs: opts?.logs
  });

  export const hybrid = (backends: Backend[]): Backend => ({
    _tag: "Hybrid",
    backends
  });

  export const auto = (opts?: {
    accountId?: string;
    apiToken?: string;
    dataset?: string;
    workerName?: string;
    pollInterval?: number;
    prefer?: "reliable" | "realtime";
  }): Backend => {
    const prefer = opts?.prefer ?? "reliable";
    
    // Prefer Analytics Engine if credentials provided
    if (opts?.accountId && opts?.apiToken) {
      if (opts.workerName && prefer === "realtime") {
        return workersLogs({
          accountId: opts.accountId,
          apiToken: opts.apiToken,
          workerName: opts.workerName,
          pollInterval: opts.pollInterval
        });
      }
      return analyticsEngine({
        accountId: opts.accountId,
        apiToken: opts.apiToken,
        dataset: opts.dataset || "worker_logs",
        pollInterval: opts.pollInterval
      });
    }
    // Fallback to CLI stream
    return cliStream({ accountId: opts?.accountId });
  };

  // Backward compatibility
  export const wranglerTail = cliStream;
  export const defaultTail = auto;
  export type Tail = Backend;
}

/* ------------------------------------ Act ----------------------------------- */

export namespace Act {
  export type Step =
    | { _tag: "Exec"; command: string; cwd?: string }
    | { _tag: "Wait"; ms: number }
    | { _tag: "Browser"; url: string; headless: boolean; waitMs: number };

  export const exec = (command: string, opts?: { cwd?: string }): Step => ({
    _tag: "Exec",
    command,
    cwd: opts?.cwd
  });

  export const wait = (ms: number): Step => ({ _tag: "Wait", ms });

  export const browser = (opts: { url: string; headless?: boolean; waitMs?: number }): Step => ({
    _tag: "Browser",
    url: opts.url,
    headless: opts.headless ?? true,
    waitMs: opts.waitMs ?? 5000
  });

  export const sequence = (steps: Step[]) => steps;
}

/* ----------------------------------- Assert --------------------------------- */

export namespace Assert {
  export type Assertion =
    | { _tag: "NoTaggedErrors" }
    | { _tag: "RequiredActions"; actions: string[] };

  export const noTaggedErrors = (): Assertion => ({ _tag: "NoTaggedErrors" });

  export const requiredActions = (actions: string[]): Assertion => ({
    _tag: "RequiredActions",
    actions
  });

  export const run = (assertions: Assertion[], logs: StructuredLog[]) =>
    Effect.gen(function* () {
      for (const a of assertions) {
        if (a._tag === "NoTaggedErrors") {
          const bad = logs.find((l) => l.status === "error" || !!l.error?.tag);
          if (bad) {
            return yield* Effect.fail(
              new AssertionFailed({
                assertion: "NoTaggedErrors",
                details: { found: bad }
              })
            );
          }
        }

        if (a._tag === "RequiredActions") {
          const seen = new Set(logs.map((l) => l.action).filter(Boolean) as string[]);
          const missing = a.actions.filter((x) => !seen.has(x));
          if (missing.length) {
            return yield* Effect.fail(
              new AssertionFailed({
                assertion: "RequiredActions",
                details: { missing, seen: [...seen] }
              })
            );
          }
        }
      }

      return true as const;
    });
}

/* ------------------------------------ Stop ---------------------------------- */

export namespace Stop {
  export type Policy = { _tag: "WhenIdle"; idleMs: number; maxMs: number };

  export const whenIdle = (opts: { idleMs: number; maxMs: number }): Policy => ({
    _tag: "WhenIdle",
    idleMs: opts.idleMs,
    maxMs: opts.maxMs
  });
}

/* ----------------------------------- Report --------------------------------- */

export namespace Report {
  export type Reporter = { _tag: "Json"; pretty: boolean } | { _tag: "Pretty" };

  export const json = (opts?: { pretty?: boolean }): Reporter => ({
    _tag: "Json",
    pretty: opts?.pretty ?? true
  });

  export const pretty = (): Reporter => ({ _tag: "Pretty" });

  export const print = (rep: Reporter, result: HarnessResult) =>
    Effect.sync(() => {
      if (rep._tag === "Json") {
        // eslint-disable-next-line no-console
        console.log(rep.pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result));
        return;
      }

      // eslint-disable-next-line no-console
      console.log(`\n[${result.status.toUpperCase()}] ${result.durationMs}ms`);
      // eslint-disable-next-line no-console
      console.log(
        `actions=${result.evidence.actionsSeen.length} stages=${result.evidence.stagesSeen.join(",") || "none"}`
      );
      if (result.evidence.errorTags.length) {
        // eslint-disable-next-line no-console
        console.log(`errorTags=${result.evidence.errorTags.join(",")}`);
      }
      if (result.status !== "success") {
        // eslint-disable-next-line no-console
        console.log(`error=${(result as any).error?._tag ?? "unknown"}`);
      }
    });
}

/* ------------------------------------ Gate ---------------------------------- */

export namespace Gate {
  export type Target = {
    // For CI, prefer setting CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
    accountId?: string;
    workerName?: string; // optional, but recommended for determinism
  };

  export type Spec = {
    name: string;
    target: Target;

    act: Act.Step[];
    observe: Observe.Backend;

    assert: Assert.Assertion[];
    stop: Stop.Policy;

    report: Report.Reporter;
  };

  export const define = (spec: Spec) => spec;

  export const run = (spec: Spec): Promise<HarnessResult> => Effect.runPromise(runEffect(spec));

  export const runEffect = (spec: Spec): Effect.Effect<HarnessResult, HarnessError> =>
    Effect.gen(function* () {
      const startedAt = Date.now();

      const logsRef = yield* Ref.make<StructuredLog[]>([]);
      const browserRef = yield* Ref.make<Evidence["browser"]>({
        consoleErrors: [],
        networkFailures: []
      });

      const q = yield* Queue.unbounded<StructuredLog>();
      const backend = yield* startObserve(spec.observe, spec.target, q);

      // Give backend a beat to connect
      yield* Effect.sleep("200 millis");

      // Stimulus
      const actExit = yield* runAct(spec.act, browserRef).pipe(Effect.either);
      if (Either.isLeft(actExit)) {
        yield* stopBackend(backend);
        const logs = yield* Ref.get(logsRef); // likely empty, but consistent shape
        const browser = yield* Ref.get(browserRef);
        const evidence = summarize(logs, browser);
        const durationMs = Date.now() - startedAt;
        const res: HarnessResult = { status: "failed", durationMs, logs, evidence, error: actExit.left };
        yield* Report.print(spec.report, res);
        return res;
      }

      // Collect logs until idle/max
      const collectExit = yield* collectLogs({
        q,
        stop: spec.stop,
        onLog: (l) => Ref.update(logsRef, (xs) => (xs.length < 50_000 ? xs.concat([l]) : xs))
      }).pipe(Effect.either);

      yield* stopBackend(backend);

      const logs = yield* Ref.get(logsRef);
      const browser = yield* Ref.get(browserRef);
      const evidence = summarize(logs, browser);
      const durationMs = Date.now() - startedAt;

      if (Either.isLeft(collectExit)) {
        const err = collectExit.left;
        const res: HarnessResult =
          err._tag === "LogTimeoutError"
            ? { status: "timeout", durationMs, logs, evidence, error: err }
            : { status: "failed", durationMs, logs, evidence, error: err };
        yield* Report.print(spec.report, res);
        return res;
      }

      // Proof
      const assertExit = yield* Assert.run(spec.assert, logs).pipe(Effect.either);
      if (Either.isLeft(assertExit)) {
        const res: HarnessResult = { status: "failed", durationMs, logs, evidence, error: assertExit.left };
        yield* Report.print(spec.report, res);
        return res;
      }

      const res: HarnessResult = { status: "success", durationMs, logs, evidence };
      yield* Report.print(spec.report, res);
      return res;
    });
}

/* ------------------------------ Implementation ------------------------------ */

type BackendHandle =
  | { type: "process"; proc: ReturnType<typeof spawn> }
  | { type: "polling"; stop: () => void }
  | { type: "endpoint"; stop: () => void }
  | { type: "local"; stop: () => void };

function startObserve(
  observe: Observe.Backend,
  target: Gate.Target,
  out: Queue.Queue<StructuredLog>
): Effect.Effect<BackendHandle, HarnessError> {
  if (observe._tag === "Hybrid") {
    // Start all backends, merge their outputs
    return startHybrid(observe.backends, target, out);
  }
  if (observe._tag === "CliStream") {
    return startCliStream(observe, target, out);
  }
  if (observe._tag === "AnalyticsEngine") {
    return startAnalyticsEngine(observe, out);
  }
  if (observe._tag === "WorkersLogs") {
    return startWorkersLogs(observe, out);
  }
  if (observe._tag === "CustomEndpoint") {
    return startCustomEndpoint(observe, out);
  }
  if (observe._tag === "Local") {
    return startLocal(observe, out);
  }
  return Effect.fail(new ObservabilityError({ cause: "Unknown observe type" }));
}

function startCliStream(
  backend: Extract<Observe.Backend, { _tag: "CliStream" }>,
  target: Gate.Target,
  out: Queue.Queue<StructuredLog>
): Effect.Effect<BackendHandle, HarnessError> {
  return Effect.try({
    try: () => {
      const args: string[] = ["tail"];

      // If workerName present, make it deterministic.
      if (target.workerName) args.push(target.workerName);

      args.push("--format", "json");

      // Prefer explicit account id (useful in CI).
      const accountId =
        backend.accountId ??
        target.accountId ??
        process.env.CLOUDFLARE_ACCOUNT_ID ??
        undefined;

      const env = { ...process.env };
      // Wrangler honors CLOUDFLARE_ACCOUNT_ID env var (not a flag)
      if (accountId) env.CLOUDFLARE_ACCOUNT_ID = accountId;

      const proc = spawn("wrangler", args, { stdio: ["ignore", "pipe", "pipe"], env });

      proc.stdout.on("data", (buf: Buffer) => {
        const lines = buf.toString("utf8").split("\n").filter(Boolean);
        for (const line of lines) {
          const parsed = parseLogLine(line);
          if (!parsed) continue;
          void Effect.runPromise(Queue.offer(out, parsed));
        }
      });

      proc.stderr.on("data", (buf: Buffer) => {
        // Keep stderr visible for diagnosis.
        process.stderr.write(buf);
      });

      return { type: "process" as const, proc };
    },
    catch: (cause) => new ObservabilityError({ cause })
  });
}

function startAnalyticsEngine(
  observe: Extract<Observe.Backend, { _tag: "AnalyticsEngine" }>,
  out: Queue.Queue<StructuredLog>
): Effect.Effect<BackendHandle, HarnessError> {
  return Effect.gen(function* () {
    let lastTimestamp = Date.now() - 60000; // Start 1 min ago
    let stopped = false;

    const poll = async () => {
      while (!stopped) {
        try {
          // Query Analytics Engine: blob1=requestId, blob2=stage, blob3=action, blob4=status, etc.
          // double2=timestamp (ms), indexes[0]=requestId
          const query = `SELECT 
            blob1 AS requestId,
            blob2 AS stage,
            blob3 AS action,
            blob4 AS status,
            blob5 AS durableObjectId,
            blob6 AS containerId,
            blob7 AS errorTag,
            blob8 AS errorMessage,
            blob9 AS data,
            double1 AS durationMs,
            double2 AS timestamp,
            indexes[0] AS index
          FROM ${observe.dataset} 
          WHERE double2 > ${lastTimestamp} 
          ORDER BY double2 ASC
          LIMIT 100`;
          
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${observe.accountId}/analytics_engine/sql`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${observe.apiToken}`,
                "Content-Type": "text/plain"
              },
              body: query
            }
          );

          if (response.ok) {
            const data = (await response.json()) as {
              success?: boolean;
              result?: Array<{
                requestId?: string;
                stage?: string;
                action?: string;
                status?: string;
                durableObjectId?: string;
                containerId?: string;
                errorTag?: string;
                errorMessage?: string;
                data?: string;
                durationMs?: number;
                timestamp?: number;
                index?: string;
              }>;
            };
            
            if (data.result && Array.isArray(data.result)) {
              for (const row of data.result) {
                if (!row.timestamp || !row.requestId) continue;
                
                // Reconstruct log entry from Analytics Engine row
                const logEntry: StructuredLog = {
                  requestId: row.requestId,
                  timestamp: new Date(row.timestamp).toISOString(),
                  stage: (row.stage || "worker") as "worker" | "durable_object" | "container",
                  action: row.action || "unknown",
                  status: (row.status || "info") as "start" | "success" | "error" | "info",
                  ...(row.durableObjectId && { durableObjectId: row.durableObjectId }),
                  ...(row.containerId && { containerId: row.containerId }),
                  ...(row.errorTag && {
                    error: {
                      tag: row.errorTag,
                      message: row.errorMessage || ""
                    }
                  }),
                  ...(row.data && { data: JSON.parse(row.data) }),
                  ...(row.durationMs !== undefined && { durationMs: row.durationMs })
                };
                
                lastTimestamp = Math.max(lastTimestamp, row.timestamp);
                void Effect.runPromise(Queue.offer(out, logEntry));
              }
            }
          }
        } catch (error) {
          // Continue polling on error
        }

        await new Promise((resolve) => setTimeout(resolve, observe.pollInterval ?? 500));
      }
    };

    void poll();

    return {
      type: "polling" as const,
      stop: () => {
        stopped = true;
      }
    };
  });
}

function startCustomEndpoint(
  observe: Extract<Observe.Backend, { _tag: "CustomEndpoint" }>,
  out: Queue.Queue<StructuredLog>
): Effect.Effect<BackendHandle, HarnessError> {
  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(observe.url, {
        headers: observe.headers
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let stopped = false;

      const read = async () => {
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n").filter(Boolean);
          for (const line of lines) {
            const log = parseLogLine(line);
            if (log) {
              void Effect.runPromise(Queue.offer(out, log));
            }
          }
        }
      };

      void read();

      return {
        type: "endpoint" as const,
        stop: () => {
          stopped = true;
          reader.cancel();
        }
      };
    },
    catch: (cause) => new ObservabilityError({ cause })
  });
}

function startWorkersLogs(
  observe: Extract<Observe.Backend, { _tag: "WorkersLogs" }>,
  out: Queue.Queue<StructuredLog>
): Effect.Effect<BackendHandle, HarnessError> {
  return Effect.gen(function* () {
    let lastTimestamp = Date.now() - 60000;
    let stopped = false;

    const poll = async () => {
      while (!stopped) {
        try {
          // Query Workers Logs API (if available)
          // Note: This is a placeholder - actual API may differ
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${observe.accountId}/workers/logs`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${observe.apiToken}`,
                "Content-Type": "application/json"
              }
            }
          );

          if (response.ok) {
            const data = (await response.json()) as { result?: StructuredLog[] };
            if (data.result && Array.isArray(data.result)) {
              for (const log of data.result) {
                if (log.timestamp) {
                  const ts = new Date(log.timestamp).getTime();
                  if (ts > lastTimestamp) {
                    lastTimestamp = ts;
                    void Effect.runPromise(Queue.offer(out, log));
                  }
                }
              }
            }
          }
        } catch (error) {
          // Continue polling on error
        }

        await new Promise((resolve) => setTimeout(resolve, observe.pollInterval ?? 1000));
      }
    };

    void poll();

    return {
      type: "polling" as const,
      stop: () => {
        stopped = true;
      }
    };
  });
}

function startLocal(
  observe: Extract<Observe.Backend, { _tag: "Local" }>,
  out: Queue.Queue<StructuredLog>
): Effect.Effect<BackendHandle, HarnessError> {
  return Effect.gen(function* () {
    let stopped = false;

    const emit = async () => {
      if (observe.logs) {
        for (const log of observe.logs) {
          if (stopped) break;
          void Effect.runPromise(Queue.offer(out, log));
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    };

    void emit();

    return {
      type: "local" as const,
      stop: () => {
        stopped = true;
      }
    };
  });
}

function startHybrid(
  backends: Observe.Backend[],
  target: Gate.Target,
  out: Queue.Queue<StructuredLog>
): Effect.Effect<BackendHandle, HarnessError> {
  return Effect.gen(function* () {
    const handles: BackendHandle[] = [];
    
    for (const backend of backends) {
      const handle = yield* startObserve(backend, target, out);
      handles.push(handle);
    }

    return {
      type: "polling" as const,
      stop: () => {
        for (const handle of handles) {
          void Effect.runPromise(stopBackend(handle));
        }
      }
    };
  });
}

function stopBackend(h: BackendHandle): Effect.Effect<void> {
  return Effect.sync(() => {
    try {
      if (h.type === "process") {
        h.proc.kill("SIGTERM");
      } else {
        h.stop();
      }
    } catch {
      // ignore
    }
  });
}

function runAct(steps: Act.Step[], browserRef: Ref.Ref<Evidence["browser"]>): Effect.Effect<void, HarnessError> {
  return Effect.gen(function* () {
    for (const s of steps) {
      if (s._tag === "Wait") {
        yield* Effect.sleep(`${s.ms} millis`);
        continue;
      }
      if (s._tag === "Exec") {
        yield* execCmd(s.command, s.cwd);
        continue;
      }
      if (s._tag === "Browser") {
        yield* runBrowser(s.url, s.headless, s.waitMs, browserRef);
        continue;
      }
    }
  });
}

function execCmd(command: string, cwd?: string): Effect.Effect<void, HarnessError> {
  return Effect.async<void, HarnessError>((resume) => {
    const proc = spawn(command, { shell: true, stdio: ["ignore", "pipe", "pipe"], cwd });
    let stderr = "";

    proc.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
      // keep last chunk bounded
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
    });

    proc.on("close", (code) => {
      if (code === 0) return resume(Effect.succeed(void 0));
      return resume(
        Effect.fail(
          new ExecError({
            command,
            code: code ?? 1,
            stderr: stderr.slice(-4000)
          })
        )
      );
    });
  });
}

function runBrowser(
  url: string,
  headless: boolean,
  waitMs: number,
  browserRef: Ref.Ref<Evidence["browser"]>
): Effect.Effect<void, HarnessError> {
  return Effect.tryPromise({
    try: async () => {
      // Optional dependency: playwright
      const pw = await import("playwright");

      const browser = await pw.chromium.launch({ headless });
      const page = await browser.newPage();

      page.on("console", (msg: any) => {
        const text = String(msg.text?.() ?? "");
        const type = String(msg.type?.() ?? "log");
        if (type === "error" || /error|failed/i.test(text)) {
          void Effect.runPromise(
            Ref.update(browserRef, (b) => ({
              consoleErrors: (b?.consoleErrors ?? []).concat([`[${type}] ${text}`]).slice(-200),
              networkFailures: b?.networkFailures ?? []
            }))
          );
        }
      });

      page.on("requestfailed", (req: any) => {
        const line = `${req.method?.()} ${req.url?.()}`;
        void Effect.runPromise(
          Ref.update(browserRef, (b) => ({
            consoleErrors: b?.consoleErrors ?? [],
            networkFailures: (b?.networkFailures ?? []).concat([line]).slice(-200)
          }))
        );
      });

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10_000 }).catch(() => {
        // Accept navigation timeouts; logs are the real truth stream.
      });

      await page.waitForTimeout(waitMs);
      await browser.close();
    },
    catch: (cause) => new BrowserError({ action: "run", cause })
  });
}

function collectLogs(opts: {
  q: Queue.Queue<StructuredLog>;
  stop: Stop.Policy;
  onLog: (l: StructuredLog) => Effect.Effect<void>;
}): Effect.Effect<void, HarnessError> {
  return Effect.gen(function* () {
    const start = Date.now();
    const lastLogAt = yield* Ref.make<number>(start);

    while (true) {
      const now = Date.now();

      if (now - start >= opts.stop.maxMs) {
        return yield* Effect.fail(new LogTimeoutError({ maxMs: opts.stop.maxMs, idleMs: opts.stop.idleMs }));
      }

      const size = yield* Queue.size(opts.q);

      if (size > 0) {
        const log = yield* Queue.take(opts.q);
        yield* Ref.set(lastLogAt, Date.now());
        yield* opts.onLog(log);
        continue;
      }

      if (now - (yield* Ref.get(lastLogAt)) >= opts.stop.idleMs) return;

      yield* Effect.sleep("200 millis");
    }
  });
}

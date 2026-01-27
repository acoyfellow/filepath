# sandbox-sdk spawn ENOENT reproduction

Minimal repro for https://github.com/cloudflare/sandbox-sdk/issues/309.

## What it does
- Builds a Sandbox container with a tiny executable at `/usr/local/bin/hello`.
- Worker endpoint `/repro` runs a Node script **inside the container** that:
  - `accessSync()` checks the binary is executable
  - `spawnSync()` tries to execute it
  - returns stdout/stderr + spawn error details

If the platform bug is present, `accessSync` succeeds but `spawnSync` may return `ENOENT`.

## Run
```bash
npm install
npm run dev
```

Then hit:
```
GET /repro
```

Example:
```bash
curl -s https://<your-worker>.workers.dev/repro | jq
```

## Expected output
A JSON response showing:
- `stdout` includes `hello-from-bin`
- `spawn error` is `null`

If the bug reproduces, you may see:
- `spawn error` = `ENOENT` even though `ls -l` + `access ok` succeed.

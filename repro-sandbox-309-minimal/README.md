# sandbox-sdk issue #309 minimal repro

This is a direct copy of the repro approach from the issue comment:
https://github.com/cloudflare/sandbox-sdk/issues/309#issuecomment-3674697960

It installs `@anthropic-ai/claude-code` in the container and exposes:
- `/spawn-test`
- `/agent-sdk-test`

These run `accessSync()` and `child_process.spawn()` checks inside the container.

## Run
```bash
npm install
npm run dev
```

Then hit:
```
GET /spawn-test
GET /agent-sdk-test
```

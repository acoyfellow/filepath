#!/bin/bash
# Gate: Agent protocol Zod schemas compile and validate all event types
cd "$(dirname "$0")/.." || exit 1

bun -e "
import { AgentEvent, AgentInput, parseAgentEvent, serializeEvent } from './src/lib/protocol/index.ts';

const events = [
  { type: 'text', content: 'hello' },
  { type: 'tool', name: 'write_file', path: 'src/a.ts', status: 'done', output: 'ok' },
  { type: 'command', cmd: 'npm test', status: 'done', exit: 0, stdout: 'pass' },
  { type: 'commit', hash: 'abc1234', message: 'feat: thing' },
  { type: 'spawn', name: 'worker-1', agent: 'shelley', model: 'sonnet-4.5' },
  { type: 'workers', workers: [{ name: 'a', status: 'done' }] },
  { type: 'status', state: 'running', context_pct: 0.5 },
  { type: 'handoff', summary: 'handing off' },
  { type: 'done', summary: 'finished' },
];

const inputs = [
  { type: 'message', from: 'user', content: 'do thing' },
  { type: 'signal', action: 'stop' },
];

let ok = true;
for (const e of events) {
  const r = AgentEvent.safeParse(e);
  if (!r.success) { console.error('Event FAIL:', e.type); ok = false; }
}
for (const i of inputs) {
  const r = AgentInput.safeParse(i);
  if (!r.success) { console.error('Input FAIL:', i.type); ok = false; }
}

// Roundtrip
const s = serializeEvent({ type: 'text', content: 'rt' });
const p = parseAgentEvent(s);
if (!p || p.type !== 'text') { console.error('Roundtrip FAIL'); ok = false; }

// Invalid returns null
if (parseAgentEvent('{\"type\":\"bogus\"}') !== null) { console.error('Invalid FAIL'); ok = false; }

if (!ok) process.exit(1);
console.log('Protocol schemas: all valid');
" || exit 1

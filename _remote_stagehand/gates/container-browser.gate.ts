import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'container-browser',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('docker run --rm filepath-agent bun run /app/agent/test-browser.ts', { timeoutMs: 60000 })
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

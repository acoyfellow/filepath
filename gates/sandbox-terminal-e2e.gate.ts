import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'sandbox-terminal-e2e',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/prod-terminal-e2e.ts', {
      timeoutMs: 120_000
    })
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

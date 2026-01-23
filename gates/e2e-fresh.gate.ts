import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'e2e-fresh',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run test/e2e-fresh.ts', { timeoutMs: 300000 })
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

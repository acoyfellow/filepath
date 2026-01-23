import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'e2e-form',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run test/e2e-form.ts', { timeoutMs: 120000 })
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

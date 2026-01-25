import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'container-registry',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run container:push', { timeoutMs: 300000 })
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

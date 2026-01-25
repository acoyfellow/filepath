import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'build-works',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run build', { timeoutMs: 60000 }),
    Act.exec('bun run gates/_checks/file-exists.ts dist/index.js')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'worker-entry',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/file-exists.ts worker/src/index.ts'),
    Act.exec('bun run gates/_checks/file-contains.ts worker/src/index.ts export default fetch')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

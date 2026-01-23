import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'worker-run',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/file-contains.ts worker/src/ContainerManager.ts instruction result screenshot')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

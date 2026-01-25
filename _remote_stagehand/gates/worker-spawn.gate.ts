import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'worker-spawn',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/file-contains.ts worker/src/ContainerManager.ts spawn container')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

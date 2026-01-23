import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'pkg-ready',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/file-contains.ts package.json "name": "main": "types": "bin":')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

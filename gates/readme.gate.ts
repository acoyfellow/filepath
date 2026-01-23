import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'readme',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/file-exists.ts README.md'),
    Act.exec('bun run gates/_checks/file-contains.ts README.md filepath install run')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'src-types',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/file-exists.ts src/types.ts'),
    Act.exec('bun run gates/_checks/file-contains.ts src/types.ts RunResult RunOptions success output screenshot error')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

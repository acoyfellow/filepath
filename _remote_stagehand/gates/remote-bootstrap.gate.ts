import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'remote-bootstrap',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/file-exists.ts svelte.config.js'),
    Act.exec('bun run gates/_checks/file-exists.ts vite.config.ts'),
    Act.exec('bun run gates/_checks/file-exists.ts drizzle.config.ts'),
    Act.exec('bun run gates/_checks/file-exists.ts src'),
    Act.exec('bun run gates/_checks/file-exists.ts worker')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

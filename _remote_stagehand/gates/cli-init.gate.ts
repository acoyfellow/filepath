import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'cli-init',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/file-exists.ts cli/init.ts'),
    Act.exec('bun run gates/_checks/file-contains.ts cli/init.ts init config CLOUDFLARE')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

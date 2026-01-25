import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-viewer-ui',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/app.tsx terminal-iframe'
    ),
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/app.tsx /terminal/ tab?tab='
    ),
    Act.exec('bun run gates/_checks/file-contains.ts src/index.ts xterm')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

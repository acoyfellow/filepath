import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'reload-restores-chat-terminals-mark-expired',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/index.ts terminal-status postMessage'
    ),
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/app.tsx terminalStatus expired'
    )
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

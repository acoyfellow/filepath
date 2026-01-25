import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-backend-pty-ws',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/index.ts ttyd -W -p 7681 bash'
    ),
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/index.ts WebSocketPair'
    ),
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/index.ts /terminal/ /start /ws'
    )
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

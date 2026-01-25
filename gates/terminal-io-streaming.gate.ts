import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-io-streaming',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/index.ts CMD_OUTPUT terminal.onData ws.binaryType'
    ),
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/index.ts /terminal/ /ws'
    )
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

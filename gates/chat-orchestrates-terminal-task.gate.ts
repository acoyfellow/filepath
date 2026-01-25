import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'chat-orchestrates-terminal-task',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/index.ts /terminal/ /task TerminalTask'
    ),
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/app.tsx selectedTerminalId terminalTasks'
    )
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

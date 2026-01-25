import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'chat-orchestrates-terminal-task',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: chat-orchestrates-terminal-task"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

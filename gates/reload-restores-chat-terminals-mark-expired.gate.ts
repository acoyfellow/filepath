import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'reload-restores-chat-terminals-mark-expired',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: reload-restores-chat-terminals-mark-expired"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

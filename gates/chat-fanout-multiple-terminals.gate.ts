import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'chat-fanout-multiple-terminals',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: chat-fanout-multiple-terminals"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

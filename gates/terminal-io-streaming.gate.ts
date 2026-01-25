import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-io-streaming',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: terminal-io-streaming"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

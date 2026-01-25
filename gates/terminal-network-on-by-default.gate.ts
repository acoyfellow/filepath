import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-network-on-by-default',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: terminal-network-on-by-default"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-create-ephemeral',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: terminal-create-ephemeral"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

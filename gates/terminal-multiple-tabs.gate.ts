import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-multiple-tabs',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: terminal-multiple-tabs"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

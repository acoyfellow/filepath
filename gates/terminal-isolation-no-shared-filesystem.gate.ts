import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-isolation-no-shared-filesystem',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: terminal-isolation-no-shared-filesystem"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

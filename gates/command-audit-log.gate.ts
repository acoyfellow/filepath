import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'command-audit-log',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: command-audit-log"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

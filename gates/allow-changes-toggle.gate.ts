import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'allow-changes-toggle',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: allow-changes-toggle"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

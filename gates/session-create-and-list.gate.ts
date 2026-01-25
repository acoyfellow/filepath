import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'session-create-and-list',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: session-create-and-list"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

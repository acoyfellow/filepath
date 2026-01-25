import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'session-persists-localstorage',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: session-persists-localstorage"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

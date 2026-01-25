import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'jump-in-pauses-agent',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: jump-in-pauses-agent"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

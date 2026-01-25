import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-viewer-ui',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: terminal-viewer-ui"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

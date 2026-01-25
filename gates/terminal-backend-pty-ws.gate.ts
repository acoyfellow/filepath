import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-backend-pty-ws',
  observe: createEmptyObserveResource(),
  act: [Act.exec('echo "TODO: terminal-backend-pty-ws"')],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

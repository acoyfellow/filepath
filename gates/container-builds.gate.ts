import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'container-builds',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('docker build -t filepath-agent .', { cwd: 'container', timeoutMs: 300000 })
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

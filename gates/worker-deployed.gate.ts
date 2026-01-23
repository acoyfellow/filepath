import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'worker-deployed',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('npx wrangler deploy', { cwd: 'worker', timeoutMs: 300000 })
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

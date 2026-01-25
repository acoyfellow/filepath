import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'harness-prod-smoke',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/env-exists.ts PROD_URL'),
    Act.exec('bun run gates/_checks/http-ok.ts "$PROD_URL"')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

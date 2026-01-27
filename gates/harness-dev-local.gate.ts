import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'harness-dev-local',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/env-exists.ts ALCHEMY_PASSWORD OPENAI_API_KEY'),
    Act.exec('bun run gates/_checks/dev-env-guard.ts'),
    Act.exec('bun run gates/_checks/http-ok.ts http://localhost:5173'),
    Act.exec('bun run gates/_checks/dev-api-ok.ts')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

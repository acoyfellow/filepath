import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'env-example',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/file-exists.ts .env.example'),
    Act.exec('bun run gates/_checks/file-contains.ts .env.example CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN ANTHROPIC_API_KEY')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

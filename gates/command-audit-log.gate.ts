import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'command-audit-log',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/file-contains.ts src/index.ts auditBySession'),
    Act.exec('bun run gates/_checks/file-contains.ts src/app.tsx commandAudit')
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'session-create-and-list',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/app.tsx session-panel chat-sessions active-session-id'
    ),
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/index.css session-panel session-list session-item'
    )
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

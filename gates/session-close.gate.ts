import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'session-close',
  observe: createEmptyObserveResource(),
  act: [
    // Backend: DELETE endpoint with teardown logic
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/index.ts DELETE closeTerminal sessions.delete sessionClients.delete tasksBySession.delete auditBySession.delete'
    ),
    // Frontend: closeSession handler
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/app.tsx closeSession window.confirm DELETE removeItem saveSessionsToStorage'
    ),
    // UI: close button in session list
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/app.tsx session-close session-item-button'
    ),
    // CSS: session close styling
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/index.css session-close session-item-button'
    ),
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

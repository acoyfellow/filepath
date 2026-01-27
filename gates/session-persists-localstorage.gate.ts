import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'session-persists-localstorage',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/app.tsx SESSION_LIST_KEY ACTIVE_SESSION_KEY getHistoryKey'
    ),
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/app.tsx loadSessionsFromStorage saveSessionsToStorage localStorage.setItem'
    )
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

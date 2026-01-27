import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-create-ephemeral',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/app.tsx createTerminalTab saveTabs terminal-frame terminal-iframe'
    ),
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/index.ts renderTerminalTabPage'
    )
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

import { Gate, Act, Assert, createEmptyObserveResource } from 'gateproof'

const result = await Gate.run({
  name: 'terminal-multiple-tabs',
  observe: createEmptyObserveResource(),
  act: [
    Act.exec('bun run gates/_checks/file-contains.ts src/index.ts /session'),
    Act.exec('bun run gates/_checks/file-contains.ts src/index.ts tabs'),
    Act.exec(
      'bun run gates/_checks/file-contains.ts src/app.tsx terminalTabs activeTerminalId'
    )
  ],
  assert: [Assert.noErrors()],
  report: 'pretty'
})

if (result.status !== 'success') {
  process.exit(1)
}

import { run } from './dist/index.js'

async function testBasicRun() {
  console.log('Testing basic run function...')
  console.log('Instruction: "get title of example.com"')

  const result = await run('get title of example.com', { debug: true, timeout: 30000 })

  console.log('\nResult:')
  console.log('Success:', result.success)
  console.log('Output:', result.output)
  if (result.error) {
    console.log('Error:', result.error)
  }
  console.log('Screenshot length:', result.screenshot.length)
  console.log('Screenshot starts with:', result.screenshot.substring(0, 50) + '...')
}

testBasicRun().catch(console.error)
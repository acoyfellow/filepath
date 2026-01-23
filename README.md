# filepath

```typescript
import { run } from 'filepath'

const result = await run("go to example.com, find contact form, fill as Jordan")

if (result.success) {
  console.log(result.output)      // what the agent did
  console.log(result.screenshot)  // base64 PNG proof
} else {
  console.error(result.error)
}
```

Natural language in, verified result out.

## Install

```bash
npm install filepath
```

## Setup

```bash
# 1. Set environment variables
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_API_TOKEN=your_api_token
export ANTHROPIC_API_KEY=your_anthropic_key

# 2. Initialize
npx filepath init

# 3. Deploy worker + container to your Cloudflare account
npx filepath deploy
```

## Usage

```typescript
import { run } from 'filepath'

// Simple navigation
const result = await run("go to example.com and get the page title")
// → { success: true, output: "Example Domain", screenshot: "..." }

// Form filling with verification
const result = await run(`
  Go to https://example.com/contact
  Fill the contact form with:
    - Name: Jordan
    - Email: jordan@company.com
    - Message: Hello from filepath
  Submit and verify it worked
`)
// → { success: true, output: "Form submitted", screenshot: "..." }

// With options
const result = await run("complex task here", {
  timeout: 120000,  // 2 minutes
  debug: true,      // verbose logging
})
```

## API

### `run(instruction, options?)`

Execute a natural language instruction.

**Parameters:**
- `instruction` (string) - What you want the agent to do
- `options.timeout` (number) - Timeout in ms (default: 60000)
- `options.debug` (boolean) - Enable verbose logging

**Returns:** `Promise<RunResult>`

```typescript
interface RunResult {
  success: boolean    // Did it work?
  output: string      // What the agent found/did
  screenshot: string  // Base64 PNG proof
  error?: string      // Error message if failed
}
```

## How it works

1. Your code calls `run(instruction)`
2. Request goes to your deployed Cloudflare Worker
3. Worker spawns a container with browser + Claude
4. Claude interprets your instruction and controls the browser
5. Agent captures screenshot proof
6. Result returned to your code

No Cloudflare Browser limits. You own the infrastructure.

## Development

```bash
# Clone reference repos
./bootstrap.sh

# Install deps
bun install

# Run the prd (shows current state)
bun run prd.ts

# Loop until all gates pass
./loop.sh
```

## License

Proprietary

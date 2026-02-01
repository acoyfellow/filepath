import { betterAuth } from 'better-auth';
import { apiKey } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

interface TestContext {
  apiKey: string;
  userId: string;
  apiKeyId: string;
}

async function setupTestContext(): Promise<TestContext> {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);

  const auth = betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    secret: 'test-secret-for-e2e-testing',
    baseURL: 'http://localhost:3000',
    plugins: [
      apiKey({
        apiKeyHeaders: ['x-api-key', 'authorization'],
        enableMetadata: true,
      }),
    ],
  });

  const user = await auth.api.signUp({
    email: 'e2e-test@example.com',
    password: 'password123',
    name: 'E2E Test User'
  });

  if (!user.data?.user) {
    throw new Error(`Failed to create user: ${JSON.stringify(user.error)}`);
  }

  const apiKeyResult = await auth.api.createApiKey({
    name: 'e2e-test-key',
    userId: user.data.user.id,
    metadata: {
      agentName: 'e2e-test-agent',
      secrets: {
        'TEST_VAR': 'test-value-123'
      },
      shell: 'bash',
      defaultDir: '/home/user'
    }
  });

  if (!apiKeyResult.data?.key || !apiKeyResult.data?.id) {
    throw new Error(`Failed to create API key: ${JSON.stringify(apiKeyResult.error)}`);
  }

  return {
    apiKey: apiKeyResult.data.key,
    userId: user.data.user.id,
    apiKeyId: apiKeyResult.data.id,
  };
}

async function testOrchestratorHealthEndpoint() {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5173';

  const response = await fetch(`${baseUrl}/api/orchestrator`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.status !== 'ok') {
    throw new Error(`Health check returned unexpected status: ${data.status}`);
  }

  return true;
}

async function testOrchestratorTaskExecution(ctx: TestContext) {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5173';

  const response = await fetch(`${baseUrl}/api/orchestrator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ctx.apiKey,
    },
    body: JSON.stringify({
      sessionId: `test-session-${Date.now()}`,
      task: 'echo hello',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Task execution failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Task execution returned success=false: ${data.error}`);
  }

  if (!data.result || !data.result.includes('hello')) {
    throw new Error(`Task result does not contain expected output: ${data.result}`);
  }

  return data;
}

async function testOrchestratorMissingApiKey() {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5173';

  const response = await fetch(`${baseUrl}/api/orchestrator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: 'test-session',
      task: 'echo hello',
    }),
  });

  if (response.status !== 401) {
    throw new Error(`Expected 401 for missing API key, got ${response.status}`);
  }

  return true;
}

async function testOrchestratorInvalidApiKey() {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5173';

  const response = await fetch(`${baseUrl}/api/orchestrator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'invalid-key-12345',
    },
    body: JSON.stringify({
      sessionId: 'test-session',
      task: 'echo hello',
    }),
  });

  if (response.status !== 401) {
    throw new Error(`Expected 401 for invalid API key, got ${response.status}`);
  }

  return true;
}

async function testOrchestratorMissingSessionId(ctx: TestContext) {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5173';

  const response = await fetch(`${baseUrl}/api/orchestrator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ctx.apiKey,
    },
    body: JSON.stringify({
      task: 'echo hello',
    }),
  });

  if (response.status !== 400) {
    throw new Error(`Expected 400 for missing sessionId, got ${response.status}`);
  }

  return true;
}

async function testOrchestratorMissingTask(ctx: TestContext) {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5173';

  const response = await fetch(`${baseUrl}/api/orchestrator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ctx.apiKey,
    },
    body: JSON.stringify({
      sessionId: 'test-session',
    }),
  });

  if (response.status !== 400) {
    throw new Error(`Expected 400 for missing task, got ${response.status}`);
  }

  return true;
}

async function runAllTests() {
  console.log('\n=== Orchestrator E2E Tests ===\n');

  let ctx: TestContext;
  try {
    console.log('Setting up test context...');
    ctx = await setupTestContext();
    console.log('Test context created');
    console.log(`  API Key ID: ${ctx.apiKeyId}`);
    console.log(`  User ID: ${ctx.userId}`);
  } catch (error) {
    console.error('Failed to set up test context:', error);
    process.exit(1);
  }

  const tests = [
    { name: 'Health endpoint', fn: testOrchestratorHealthEndpoint },
    { name: 'Task execution', fn: () => testOrchestratorTaskExecution(ctx) },
    { name: 'Missing API key', fn: testOrchestratorMissingApiKey },
    { name: 'Invalid API key', fn: testOrchestratorInvalidApiKey },
    { name: 'Missing sessionId', fn: () => testOrchestratorMissingSessionId(ctx) },
    { name: 'Missing task', fn: () => testOrchestratorMissingTask(ctx) },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      process.stdout.write(`Testing ${test.name}... `);
      await test.fn();
      console.log('PASSED');
      passed++;
    } catch (error) {
      console.log(`FAILED: ${error}`);
      failed++;
    }
  }

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}/${tests.length}`);
  console.log(`Failed: ${failed}/${tests.length}`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log('\nAll tests passed!');
}

runAllTests().catch(console.error);

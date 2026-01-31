import { betterAuth } from 'better-auth';
import { apiKey } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

// Create in-memory SQLite database for testing
const sqlite = new Database(':memory:');
const db = drizzle(sqlite);

// Create a minimal auth instance for testing
const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),
  secret: 'test-secret-for-testing',
  baseURL: 'http://localhost:3000',
  plugins: [
    apiKey({
      apiKeyHeaders: ['x-api-key', 'authorization'],
      enableMetadata: true,
    }),
  ],
});

// Test function to create a user and API key
async function testApiKeyFunctionality() {
  console.log('Testing API key functionality...');
  
  // Create a test user
  const user = await auth.api.signUp({
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  });
  
  console.log('Created user:', user);
  
  if (!user.data?.user) {
    console.error('Failed to create user:', user.error);
    return;
  }
  
  // Create an API key for the user with metadata
  const apiKeyResult = await auth.api.createApiKey({
    name: 'test-agent-key',
    userId: user.data.user.id,
    metadata: {
      agentName: 'test-agent',
      secrets: {
        'TEST_SECRET': 'test-value',
        'ANOTHER_SECRET': 'another-value'
      },
      shell: 'bash',
      defaultDir: '/home/user'
    }
  });
  
  console.log('Created API key:', apiKeyResult);
  
  if (!apiKeyResult.data?.key) {
    console.error('Failed to create API key:', apiKeyResult.error);
    return;
  }
  
  // Test API key validation
  const validation = await auth.api.verifyApiKey({
    key: apiKeyResult.data.key
  });
  
  console.log('API key validation result:', validation);
  
  if (!validation.valid) {
    console.error('API key validation failed:', validation.error);
    return;
  }
  
  // Test metadata extraction
  if (validation.key?.metadata) {
    console.log('API key metadata:', validation.key.metadata);
    
    // Extract secrets from metadata
    const metadata = validation.key.metadata as { secrets?: Record<string, string> };
    if (metadata.secrets) {
      console.log('Extracted secrets:', metadata.secrets);
    }
  }
  
  console.log('API key functionality test completed successfully!');
}

// Run the test
testApiKeyFunctionality().catch(console.error);

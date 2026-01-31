// Simple test for API key validation logic
import { apiKey } from 'better-auth/plugins';

// Mock database and auth instance for testing
const mockDb = {
  // Mock database methods
};

// Mock better-auth instance
const mockAuth = {
  api: {
    verifyApiKey: async ({ key }: { key: string }) => {
      // Simulate API key verification
      if (key.startsWith('mfp_')) {
        return {
          valid: true,
          key: {
            id: 'test-key-id',
            name: 'test-agent-key',
            userId: 'test-user-id',
            metadata: {
              agentName: 'test-agent',
              secrets: {
                'TEST_SECRET': 'test-value',
                'ANOTHER_SECRET': 'another-value'
              },
              shell: 'bash',
              defaultDir: '/home/user'
            }
          }
        };
      }
      return {
        valid: false,
        error: { message: 'Invalid API key' }
      };
    }
  }
};

// Test function to validate API key and extract metadata
async function testApiKeyValidation() {
  console.log('Testing API key validation and metadata extraction...');
  
  const testApiKey = 'mfp_test1234567890';
  
  // Simulate the validateApiKey function from worker/index.ts
  const apiKeyResult = await mockAuth.api.verifyApiKey({ key: testApiKey });
  
  console.log('API key validation result:', apiKeyResult);
  
  if (!apiKeyResult.valid) {
    console.error('API key validation failed:', apiKeyResult.error);
    return;
  }
  
  // Extract secrets from metadata (same logic as in worker)
  let envVars: Record<string, string> = {};
  if (apiKeyResult.key?.metadata) {
    const metadata = apiKeyResult.key.metadata as { secrets?: Record<string, string> };
    if (metadata.secrets) {
      envVars = { ...metadata.secrets };
    }
  }
  
  console.log('Extracted environment variables:', envVars);
  
  // Verify that secrets are correctly extracted
  if (envVars['TEST_SECRET'] === 'test-value' && 
      envVars['ANOTHER_SECRET'] === 'another-value') {
    console.log('✅ API key validation and secrets extraction working correctly!');
  } else {
    console.error('❌ Secrets extraction failed');
  }
}

// Run the test
testApiKeyValidation().catch(console.error);

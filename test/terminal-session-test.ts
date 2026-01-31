// Test for terminal session creation with API key authentication
import { apiKey } from 'better-auth/plugins';

// Mock sandbox for testing
const mockSandbox = {
  startProcess: async (command: string, options?: { env?: Record<string, string> }) => {
    console.log('Starting process:', command);
    console.log('With environment variables:', options?.env || {});
    
    // Simulate successful process start
    return {
      kill: async (signal?: string) => {
        console.log('Process killed with signal:', signal);
      }
    };
  }
};

// Mock better-auth instance for API key validation
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
                'ANTHROPIC_API_KEY': 'sk-ant-1234567890',
                'GITHUB_TOKEN': 'ghp_1234567890',
                'DATABASE_URL': 'postgresql://user:pass@localhost/db'
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

// Simulate the validateApiKey function from worker/index.ts
async function validateApiKey(apiKeyHeader: string) {
  if (!apiKeyHeader) {
    return { valid: false, error: 'No API key provided' };
  }
  
  try {
    // Use the auth API to verify the API key
    const result = await mockAuth.api.verifyApiKey({
      key: apiKeyHeader
    });
    
    if (!result.valid) {
      return { valid: false, error: result.error?.message || 'Invalid API key' };
    }
    
    return { valid: true, key: result.key };
  } catch (error) {
    return { valid: false, error: `API key validation failed: ${error}` };
  }
}

// Test function to simulate terminal start with API key authentication
async function testTerminalStartWithApiKey() {
  console.log('Testing terminal session creation with API key authentication...');
  
  const testApiKey = 'mfp_agent1234567890';
  const sessionId = 'test-session-123';
  const tabId = 'tab-456';
  const terminalId = `t-${sessionId.replace(/[^a-z0-9-]/gi, '')}-${tabId.replace(/[^a-z0-9-]/gi, '')}`;
  
  console.log('Terminal ID:', terminalId);
  
  // Validate API key and retrieve metadata
  const apiKeyResult = await validateApiKey(testApiKey);
  
  console.log('API key validation result:', apiKeyResult);
  
  if (!apiKeyResult.valid) {
    console.error('❌ API key validation failed:', apiKeyResult.error);
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
  
  console.log('Extracted environment variables for terminal:', envVars);
  
  // Simulate starting terminal with environment variables
  try {
    console.log('Starting terminal process with injected secrets...');
    const ttyd = await mockSandbox.startProcess('ttyd -W -p 7681 bash', { env: envVars });
    
    console.log('✅ Terminal started successfully with secrets injection!');
    
    // Verify that secrets are in the environment
    const expectedSecrets = ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'DATABASE_URL'];
    const missingSecrets = expectedSecrets.filter(secret => !envVars[secret]);
    
    if (missingSecrets.length === 0) {
      console.log('✅ All expected secrets are present in the environment');
    } else {
      console.error('❌ Missing secrets:', missingSecrets);
    }
    
    // Simulate cleanup
    await ttyd.kill('SIGTERM');
    console.log('✅ Terminal process cleaned up');
    
  } catch (error) {
    console.error('❌ Failed to start terminal:', error);
  }
}

// Run the test
testTerminalStartWithApiKey().catch(console.error);

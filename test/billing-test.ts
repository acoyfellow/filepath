import { BillingService } from '../src/lib/billing';

// Mock D1 database for testing
const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        get: () => ({
          id: 'test-user-id',
          creditBalance: 1000,
          userId: 'test-user-id'
        })
      }),
      all: () => [
        {
          id: 'test-apikey-id',
          creditBalance: 0,
          budgetCap: 500,
          totalUsageMinutes: 0,
          userId: 'test-user-id'
        }
      ]
    })
  }),
  update: () => ({
    set: () => ({
      where: () => Promise.resolve()
    })
  })
};

async function testBillingService() {
  console.log('Testing Billing Service...');
  
  const billingService = new BillingService(mockDb as any);
  
  // Test checkQuota
  const quotaResult = await billingService.checkQuota('test-apikey-id');
  console.log('Check quota result:', quotaResult);
  
  // Test deductCredits
  const deductResult = await billingService.deductCredits('test-apikey-id', 10);
  console.log('Deduct credits result:', deductResult);
  
  // Test getUserBalance
  const balance = await billingService.getUserBalance('test-user-id');
  console.log('User balance:', balance);
  
  // Test getApiKeyUsage
  const usage = await billingService.getApiKeyUsage('test-apikey-id');
  console.log('API key usage:', usage);
  
  console.log('Billing service test completed!');
}

testBillingService().catch(console.error);

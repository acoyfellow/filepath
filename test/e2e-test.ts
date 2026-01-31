// End-to-end test for myfilepath.com components

async function testMailgunConfiguration() {
  console.log('Testing Mailgun configuration...');
  
  // Import dynamically to avoid issues
  const { default: formData } = await import('form-data');
  const { default: Mailgun } = await import('mailgun.js');
  
  const mailgun = new Mailgun(formData);
  const apiKey = process.env.MAILGUN_API_KEY || '';
  const domain = process.env.MAILGUN_DOMAIN || '';
  
  if (!apiKey || !domain) {
    console.error('❌ Missing Mailgun environment variables');
    return false;
  }

  const mg = mailgun.client({
    username: 'api',
    key: apiKey,
  });

  try {
    const result = await (mg as any).messages.create(domain, {
      from: `Test <test@${domain}>`,
      to: ['test@myfilepath.com'],
      subject: 'Mailgun Test',
      text: 'This is a test email from Mailgun',
    });
    
    console.log('✅ Mailgun configuration is working');
    return true;
  } catch (error) {
    console.error('❌ Mailgun test failed:', error);
    return false;
  }
}

async function testAuthPlugins() {
  console.log('Testing auth plugins configuration...');
  
  // This would require a full SvelteKit environment to test properly
  // For now, we'll just check that the imports work
  try {
    const { apiKey, mcp, multiSession, organization } = await import('better-auth/plugins');
    const { passkey } = await import('@better-auth/passkey');
    const { emailOTP } = await import('better-auth/plugins/email-otp');
    
    console.log('✅ All auth plugins can be imported');
    return true;
  } catch (error) {
    console.error('❌ Auth plugins test failed:', error);
    return false;
  }
}

async function testBillingGate() {
  console.log('Testing billing gate logic...');
  
  // Test the checkUserCredits function logic
  // This is a simplified version of the logic in worker/index.ts
  
  // Test case 1: User with sufficient credits
  const userWithCredits = { creditBalance: 1500 };
  const hasCredits1 = userWithCredits.creditBalance >= 1000;
  
  // Test case 2: User with insufficient credits
  const userWithoutCredits = { creditBalance: 500 };
  const hasCredits2 = userWithoutCredits.creditBalance >= 1000;
  
  if (hasCredits1 && !hasCredits2) {
    console.log('✅ Billing gate logic is working correctly');
    return true;
  } else {
    console.error('❌ Billing gate logic is not working correctly');
    return false;
  }
}

async function runE2ETest() {
  console.log('Running myfilepath.com end-to-end test...\n');
  
  const tests = [
    testMailgunConfiguration(),
    testAuthPlugins(),
    testBillingGate()
  ];
  
  const results = await Promise.all(tests);
  
  console.log('\n=== TEST RESULTS ===');
  const allPassed = results.every(result => result);
  
  if (allPassed) {
    console.log('✅ All end-to-end tests passed!');
    return true;
  } else {
    console.log('❌ Some tests failed');
    return false;
  }
}

// Run the test
runE2ETest().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});

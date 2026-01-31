#!/usr/bin/env ts-node

import { createCreditsProduct } from '../src/lib/stripe/index';

async function main() {
  try {
    console.log('Creating Stripe product for myfilepath credits...');
    
    const { productId, priceId } = await createCreditsProduct();
    
    console.log('✅ Successfully created Stripe product and price:');
    console.log(`   Product ID: ${productId}`);
    console.log(`   Price ID: ${priceId}`);
    console.log('\nYou can now use these IDs in your checkout sessions.');
  } catch (error) {
    console.error('❌ Error creating Stripe product:', error);
    process.exit(1);
  }
}

main();

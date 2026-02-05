/**
 * Seed script for fresh database
 * Creates test user: jordan@sendgrowth.com / test123
 */
import { hashPassword } from 'better-auth/crypto';

const userId = 'seed-user-' + Date.now();
const email = 'jordan@sendgrowth.com';
const password = 'test123';
const name = 'Jordan';

async function generateSeed() {
  const hashedPassword = await hashPassword(password);
  const now = Date.now();
  
  // User record
  const userInsert = `
INSERT INTO "user" (id, name, email, email_verified, credit_balance, created_at, updated_at)
VALUES ('${userId}', '${name}', '${email}', 1, 1000, ${now}, ${now});
`;

  // Account record (for password auth)
  const accountId = 'seed-account-' + Date.now();
  const accountInsert = `
INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
VALUES ('${accountId}', '${email}', 'credential', '${userId}', '${hashedPassword}', ${now}, ${now});
`;

  console.log('-- Seed data for fresh database');
  console.log('-- User: jordan@sendgrowth.com / test123');
  console.log('-- Credits: 1000');
  console.log('');
  console.log(userInsert);
  console.log(accountInsert);
}

generateSeed().catch(console.error);

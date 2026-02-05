-- Seed data for fresh database
-- User: jordan@sendgrowth.com / test123
-- Credits: 1000


INSERT INTO "user" (id, name, email, email_verified, credit_balance, created_at, updated_at)
VALUES ('seed-user-1770289448649', 'Jordan', 'jordan@sendgrowth.com', 1, 1000, 1770289449048, 1770289449048);


INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
VALUES ('seed-account-1770289449048', 'jordan@sendgrowth.com', 'credential', 'seed-user-1770289448649', '4a74674042f4ac683f3ca22681c09b77:b011990254898ffd1d1a04197c5a070fa2dfe5eb5a5be847f1f90a324d36c8601610704bc5db5ac5128813bbff1a468438da8e2415133d5b01d5dd6ab47044bf', 1770289449048, 1770289449048);


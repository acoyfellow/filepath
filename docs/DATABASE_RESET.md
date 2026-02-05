# Database Reset Process

**Use this when:** Schema changes cause migration conflicts, or you need a clean slate.

**WARNING:** This destroys ALL production data. Only use in pre-launch/testing.

## Process

### 1. Generate Fresh Seed Data

```bash
npx tsx scripts/seed.ts > scripts/seed.sql
```

This creates a test user:
- Email: `jordan@sendgrowth.com`
- Password: `test123`
- Credits: 1000

### 2. Destroy All Alchemy Resources

```bash
alchemy destroy
```

Confirm when prompted. This deletes:
- All D1 databases (prod + preview)
- All Workers
- All Durable Objects
- All KV namespaces

### 3. Delete Migration History

```bash
rm -rf migrations/
mkdir migrations
```

### 4. Generate Fresh Migration

The schema is defined in `src/lib/schema.ts`. Export it to SQL:

```bash
cat migrations/0000_initial_schema.sql
```

If this doesn't exist, regenerate from schema:

```bash
npm run db:generate
```

### 5. Deploy Fresh

```bash
npm run deploy
```

Alchemy will:
- Create fresh D1 database
- Run migration (creates tables)
- Deploy Worker

### 6. Seed Database

```bash
# Get D1 database ID from alchemy state
alchemy state | grep -A 5 "filepath-db"

# Run seed
wrangler d1 execute <DATABASE_ID> --file=scripts/seed.sql --remote
```

Or via GitHub Actions (already configured to deploy on push to main).

### 7. Verify

Login at https://myfilepath.com with `jordan@sendgrowth.com` / `test123`.

## Why This Happens

D1 migrations are **append-only**. If you:
- Change existing migration files
- Alter table schema after deploy
- Manually modify production DB

...migrations will conflict with existing tables.

## Prevention (Future)

Once we have real users:

1. **Never edit existing migrations** - only add new ones
2. **Use `ALTER TABLE` migrations** for schema changes
3. **Test migrations locally first** with `wrangler d1 execute --local`
4. **Backup before deploy** (D1 exports)

## Automation Idea

Add to `gates/health.sh`:

```bash
# Check if migrations match deployed schema
# Warn if drift detected
```

## Current Schema

See `src/lib/schema.ts` for source of truth.

Tables:
- `user` - Better-auth users (+ credit_balance, stripe_customer_id)
- `session` - Better-auth sessions
- `account` - Better-auth accounts (password stored here)
- `verification` - Better-auth email verification codes
- `passkey` - Better-auth passkey credentials
- `apikey` - API keys with metadata (credit_balance, budget_cap, encrypted_secrets)

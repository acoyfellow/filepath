# Deployment Guide - myfilepath.com

Last updated: Feb 5, 2026

## Quick Deploy

```bash
# Ensure build passes
npx tsc --noEmit

# Deploy to production
npm run deploy

# Deploy to preview
npm run deploy:preview
```

## Pre-Deployment Checklist

### Code Quality
- [ ] `npx tsc --noEmit` passes (no type errors)
- [ ] `bash gates/health.sh` passes
- [ ] No Svelte 4 syntax (`on:click` → `onclick`)
- [ ] No explicit `any` types
- [ ] All new files committed

### Environment
- [ ] `.env` has all required variables
- [ ] GitHub secrets match local `.env`
- [ ] Alchemy password consistent

### Testing
- [ ] Local dev server works (`npm run dev`)
- [ ] Auth flow works (signup, login, logout)
- [ ] API key creation works
- [ ] Terminal sessions launch

## Required Environment Variables

### Local (.env)
```bash
# Cloudflare
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_API_TOKEN=xxx

# Auth
BETTER_AUTH_SECRET=xxx
BETTER_AUTH_URL=https://myfilepath.com

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Alchemy
ALCHEMY_PASSWORD=xxx
ALCHEMY_STATE_TOKEN=xxx

# Database
D1_DATABASE_ID=xxx
```

### GitHub Secrets
Must match local `.env`:
- `ALCHEMY_PASSWORD`
- `ALCHEMY_STATE_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `BETTER_AUTH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## GitHub Actions Workflow

Deploy runs on every push to `main`. Check status:

```bash
# List recent runs
gh run list --limit 5

# View logs for a run
gh run view <RUN_ID> --log 2>/dev/null | tail -100

# Quick failure diagnosis
gh run view <RUN_ID> --log 2>/dev/null | grep -A5 "error\|ERROR\|failed" | head -30

# Re-run failed workflow
gh run rerun <RUN_ID>
```

## Common Deploy Failures

### 1. Type Errors
**Symptom:** Build fails on `tsc`
**Fix:** Run `npx tsc --noEmit` locally, fix all errors

### 2. Alchemy State Mismatch
**Symptom:** "Decryption failed" or state errors
**Fix:** Ensure `ALCHEMY_PASSWORD` matches between local and GitHub secrets

### 3. Missing Secrets
**Symptom:** Undefined environment variables
**Fix:** Check `gh secret list`, add missing secrets

### 4. Cloudflare API Auth
**Symptom:** "Authentication error [code: 10000]"
**Fix:** For Vectorize/AI operations, use global API key instead of token

## Rollback

```bash
# View recent deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback
```

## Monitoring

```bash
# Real-time logs
npx wrangler tail --format pretty

# Check worker status
npx wrangler deployments list
```

## Alchemy Infrastructure

Infrastructure is defined in `alchemy.run.ts`. Changes deploy automatically.

**Resources managed:**
- D1 Database
- Durable Objects (TaskAgent)
- Containers
- Workflows
- Service bindings

## Post-Deploy Verification

### Manual Checks
1. **Site loads:** https://myfilepath.com
2. **Auth works:** Can login/signup
3. **Dashboard loads:** https://myfilepath.com/dashboard
4. **API responds:** `curl https://myfilepath.com/api/health`

### Automated Verification Script

```bash
#!/bin/bash
# post-deploy-check.sh

echo "Checking myfilepath.com deployment..."

# Check site loads
if curl -s -o /dev/null -w "%{http_code}" https://myfilepath.com | grep -q "200"; then
  echo "✅ Site loads"
else
  echo "❌ Site down"
  exit 1
fi

# Check auth endpoint
if curl -s https://myfilepath.com/api/auth/session | grep -q "session"; then
  echo "✅ Auth endpoint responds"
else
  echo "⚠️ Auth endpoint issue"
fi

echo "Deployment verified!"
```

## Emergency Procedures

### Site Down

1. Check GitHub Actions for failed deploy:
   ```bash
   gh run list --limit 5
   ```

2. Check Cloudflare status:
   ```bash
   npx wrangler deployments list
   ```

3. Rollback if needed:
   ```bash
   npx wrangler rollback
   ```

4. Check logs:
   ```bash
   npx wrangler tail --format pretty
   ```

### Auth Issues

1. Verify D1 database is accessible
2. Check better-auth secret matches
3. Check session cookie domain

### Billing Issues

1. Verify Stripe webhook secret
2. Check Stripe dashboard for webhook deliveries
3. Check D1 for credit balance records

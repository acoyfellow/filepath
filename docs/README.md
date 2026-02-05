# Documentation - myfilepath.com

Last updated: Feb 5, 2026

## Quick Links

| Document | Purpose |
|----------|--------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deploy checklist, environment setup, rollback |
| [INTEGRATION-STATUS.md](./INTEGRATION-STATUS.md) | Component integration status |
| [API-REFERENCE.md](./API-REFERENCE.md) | API endpoints, auth, examples |
| [KNOWN-ISSUES.md](./KNOWN-ISSUES.md) | Active blockers and resolved issues |
| [passkey-implementation-guide.md](./passkey-implementation-guide.md) | Future passkey auth notes |

## Project Files

| File | Purpose |
|------|--------|
| [/AGENTS.md](../AGENTS.md) | Agent instructions for this codebase |
| [/README.md](../README.md) | Project overview and architecture |
| [/PLAN.md](../PLAN.md) | Implementation plan and roadmap |

## Architecture

```
Agent/Human → TaskAgent (DO) → Workflows → Containers
              ↓                    ↓          ↓
           API Keys          Long-running  Execution
           Streaming         Orchestration Environment
```

## Current Sprint (Feb 2026)

**Focus:** Production readiness for agent API

1. 🔄 Container integration in ExecuteTaskWorkflow
2. 🔄 Real API key validation in TaskAgent
3. 🔄 Progress streaming to WebSocket clients
4. ❌ E2E agent test automation

## Getting Help

- Check [KNOWN-ISSUES.md](./KNOWN-ISSUES.md) first
- Run `bash gates/health.sh` for build status
- Check GitHub Actions for deploy status: `gh run list --limit 5`

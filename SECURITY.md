# Security

## Supported versions

Security fixes are applied to the default branch (`main`) of this repository. Deployed instances should track `main` or a tagged release you maintain.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

- Email the maintainers at a private contact you already use for this project, or open a **GitHub Security Advisory** (if enabled for the repo) with reproduction steps and impact.
- Include affected versions/commits, environment (e.g. Cloudflare Workers, local dev), and any proof-of-concept that demonstrates the issue without harming production data.

We aim to acknowledge reports within a few business days and coordinate disclosure after a fix is available.

## Scope

This policy covers the filepath application code in this repository and its documented deployment path (SvelteKit on Cloudflare, Workers, D1, and related secrets). Third-party services (model providers, email, Stripe, etc.) follow their own security programs.

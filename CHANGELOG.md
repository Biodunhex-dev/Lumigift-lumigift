# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

---

## [0.1.0] - 2024-12-15

### Added

#### Core Features

- Time-locked cash gift creation with surprise unlock dates
- Phone-based OTP authentication via Termii SMS
- Sender dashboard for tracking sent gifts
- Gift claiming flow for recipients
- Gift cancellation before unlock date

#### Blockchain Integration

- Soroban smart contract for escrow with time-lock enforcement
- USDC stablecoin support on Stellar testnet
- Stellar transaction tracking and event indexing
- Automated unlock scheduler via cron jobs

#### Payment Processing

- Paystack integration for Nigerian Naira (NGN) on-ramp
- Stripe integration for international card payments
- Payment callback handling and verification
- Webhook processing for payment status updates

#### User Experience

- Responsive Next.js 14 App Router frontend
- Vanilla CSS design system with accessibility focus
- Gift card preview with media upload support
- Real-time gift status tracking
- Email and SMS notifications for gift events

#### Developer Experience

- TypeScript throughout with strict type checking
- Zod schemas for runtime validation
- Comprehensive test suite (Jest + Playwright)
- Visual regression testing with Playwright
- Load testing with k6
- OpenAPI documentation at `/api/docs`
- Docker Compose for local development
- Terraform infrastructure as code
- CI/CD pipeline with GitHub Actions
- Pre-commit hooks with Husky and gitleaks
- Conventional commits enforcement

#### Security & Compliance

- Secret scanning with gitleaks
- AML/regulatory gift amount limits
- Device tracking for fraud prevention
- Phone number hashing for privacy
- Rate limiting on API endpoints
- WCAG 2.1 AA accessibility compliance tracking

#### Documentation

- Architecture Decision Records (ADRs)
- API documentation with OpenAPI spec
- Local development setup guide
- Database backup and recovery procedures
- Performance benchmarking results
- Security audit plan
- Contributing guidelines
- Code of conduct

### Security

- Environment variable validation on startup
- NextAuth.js session management with JWT
- Secure key rotation support for auth secrets
- Cron job authentication with bearer tokens
- Webhook signature verification (Stripe)

---

## Release History

[Unreleased]: https://github.com/JosephOnuh/Lumigift-lumigift/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/JosephOnuh/Lumigift-lumigift/releases/tag/v0.1.0

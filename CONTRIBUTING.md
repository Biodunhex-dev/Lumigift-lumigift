# Contributing to Lumigift

Thank you for your interest in contributing! Lumigift is an open-source project built on the Stellar blockchain, and we welcome contributions of all kinds.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Branch Protection Rules](#branch-protection-rules)
- [Smart Contract Contributions](#smart-contract-contributions)
- [Reporting Bugs](#reporting-bugs)

---

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

---

## Getting Started

### Prerequisites

| Tool        | Version                                       |
| ----------- | --------------------------------------------- |
| Node.js     | ≥ 20                                          |
| npm         | ≥ 10                                          |
| Rust        | stable (for contract work)                    |
| Stellar CLI | latest                                        |
| gitleaks    | ≥ 8 (required for pre-commit secret scanning) |

Install gitleaks before your first commit:

```bash
# macOS
brew install gitleaks

# Linux (replace VERSION with latest from https://github.com/gitleaks/gitleaks/releases)
VERSION=v8.30.1
curl -sSL "https://github.com/gitleaks/gitleaks/releases/download/${VERSION}/gitleaks_${VERSION#v}_linux_x64.tar.gz" \
  | tar -xz -C /usr/local/bin gitleaks

# Windows (via Chocolatey)
choco install gitleaks
```

### Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/lumigift.git
cd lumigift

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local
# Fill in the required values (see .env.example for guidance)

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Stellar Testnet

For blockchain features, use the Stellar Testnet. You can fund a test account at [https://laboratory.stellar.org/#account-creator](https://laboratory.stellar.org/#account-creator).

---

## Development Workflow

```bash
npm run dev          # Start Next.js dev server
npm run lint         # ESLint
npm run type-check   # TypeScript check
npm run format       # Prettier
npm test             # Jest unit tests
npm run contract:build  # Build Soroban WASM
npm run contract:test   # Run Rust contract tests
```

### Secret scanning

The pre-commit hook runs [gitleaks](https://github.com/gitleaks/gitleaks) on staged files before every commit. If it finds a potential secret, the commit is blocked and the match is shown (value redacted).

**If you get a false positive** (e.g. a test fixture or placeholder value), add an allowlist entry to `.gitleaks.toml` and commit that change first:

```toml
[[rules.allowlist]]
description = "Explain why this is not a real secret"
paths = ["path/to/file"]
regexes = ["the-matching-pattern"]
```

Never disable the hook entirely or use `--no-verify` to bypass it. If you believe the detection is wrong, open an issue or update the allowlist instead.

**To run the scan manually** against all staged changes:

```bash
gitleaks protect --staged --config=.gitleaks.toml --redact
```

**To scan the full repo history:**

```bash
gitleaks detect --config=.gitleaks.toml --redact
```

---

## Project Structure

```
src/
├── app/            # Next.js App Router (pages + API routes)
├── server/         # Server-only business logic
│   ├── services/   # Core domain logic
│   ├── middleware/ # Auth, rate limiting
│   └── config/     # Server config
├── components/     # React UI components
├── lib/            # Third-party integrations (Stellar, Paystack, SMS)
├── types/          # TypeScript types and Zod schemas
└── styles/         # Vanilla CSS design system
contracts/
└── escrow/         # Soroban smart contract (Rust)
```

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) to enable automated changelog generation:

```
<type>(<scope>): <short description>

Types: feat | fix | docs | style | refactor | perf | test | chore | ci | revert
```

Examples:

- `feat(gift): add media upload to gift creation`
- `fix(contract): prevent double-claim race condition`
- `docs: update contributing guide`

### Commit Types and Changelog Mapping

| Type       | Description                         | Appears in Changelog |
| ---------- | ----------------------------------- | -------------------- |
| `feat`     | New feature                         | ✅ Added             |
| `fix`      | Bug fix                             | ✅ Fixed             |
| `docs`     | Documentation only                  | ❌                   |
| `style`    | Code style (formatting, whitespace) | ❌                   |
| `refactor` | Code refactoring                    | ❌                   |
| `perf`     | Performance improvement             | ✅ Changed           |
| `test`     | Adding or updating tests            | ❌                   |
| `chore`    | Maintenance tasks                   | ❌                   |
| `ci`       | CI/CD changes                       | ❌                   |
| `revert`   | Revert previous commit              | ✅ Fixed             |

**Breaking changes:** Add `BREAKING CHANGE:` in the commit body or append `!` after the type:

```
feat(api)!: remove deprecated v1 endpoints

BREAKING CHANGE: The /api/v1/legacy endpoints have been removed. Use /api/v2 instead.
```

---

## Changelog Updates

We maintain [CHANGELOG.md](CHANGELOG.md) following the [Keep a Changelog](https://keepachangelog.com/) format.

### When to Update the Changelog

- **Automated:** Changelog entries are generated from conventional commit messages during release
- **Manual:** For complex features or breaking changes, add detailed context to the `[Unreleased]` section

### Changelog Sections

Changes are grouped under these categories:

- **Added** — New features (`feat` commits)
- **Changed** — Changes to existing functionality (`perf`, major `refactor`)
- **Deprecated** — Features marked for removal
- **Removed** — Deleted features (breaking changes)
- **Fixed** — Bug fixes (`fix` commits)
- **Security** — Security improvements or vulnerability fixes

### Release Process

1. All changes accumulate in the `[Unreleased]` section
2. On release, the maintainer:
   - Renames `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`
   - Creates a new empty `[Unreleased]` section
   - Updates comparison links at the bottom
   - Tags the release in Git

### Example Entry

```markdown
## [1.2.0] - 2024-12-20

### Added

- Gift scheduling for future delivery dates (#45)
- Email notifications for gift events (#52)

### Fixed

- Race condition in concurrent gift claims (#48)
- Incorrect timezone handling in unlock scheduler (#51)

### Security

- Implement rate limiting on OTP endpoints (#50)
```

---

## Pull Request Process

1. Create a branch from `develop`: `git checkout -b feat/your-feature`
2. Make your changes with tests where applicable
3. Ensure all checks pass: `npm run lint && npm run type-check && npm test`
4. Open a PR against `develop` (not `main`)
5. Fill in the PR template
6. Request a review — PRs require at least one approval

---

## Branch Protection Rules

Both `main` and `develop` are protected branches. The rules below are enforced via GitHub repository settings and cannot be bypassed by any contributor, including maintainers.

### `main`

| Rule                              | Setting                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| Required approving reviews        | 1                                                                         |
| Dismiss stale reviews on new push | ✅                                                                        |
| Require status checks to pass     | `lint-and-type-check`, `test`, `build`, `contract-test`, `contract-build` |
| Require branches to be up to date | ✅                                                                        |
| Direct pushes                     | ❌ Disabled                                                               |
| Force pushes                      | ❌ Disabled                                                               |
| Branch deletion                   | ❌ Disabled                                                               |

### `develop`

| Rule                              | Setting                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| Required approving reviews        | —                                                                         |
| Require status checks to pass     | `lint-and-type-check`, `test`, `build`, `contract-test`, `contract-build` |
| Require branches to be up to date | ✅                                                                        |
| Direct pushes                     | ❌ Disabled                                                               |
| Force pushes                      | ❌ Disabled                                                               |
| Branch deletion                   | ✅ Allowed                                                                |

### Why these rules?

- **No direct pushes** — all changes must go through a PR so CI runs and history stays clean.
- **Required CI checks** — a PR cannot be merged until every workflow job in `ci.yml` passes.
- **1 approval on `main`** — production code gets a second pair of eyes before it ships.
- **Force-push disabled** — prevents rewriting shared history and breaking other contributors' local branches.
- **Deletion disabled on `main`** — the production branch cannot be accidentally removed.

---

## Smart Contract Contributions

The Soroban escrow contract lives in `contracts/escrow/`. Before making changes:

1. Read the [Soroban documentation](https://developers.stellar.org/docs/build/smart-contracts)
2. Write tests in `contracts/escrow/src/lib.rs`
3. Run `npm run contract:test` to verify
4. Document any new public functions with Rust doc comments

Security-sensitive contract changes require two approvals.

---

## Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md). For security vulnerabilities, please email **security@lumigift.com** instead of opening a public issue.

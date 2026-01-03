# Contributing to ThinkEx

Thanks for your interest in contributing to **ThinkEx**! 🎉  
We welcome bug reports, feature suggestions, and pull requests.

Please read this guide before getting started.

---

## Project Scope & Expectations

ThinkEx is a **production application**, not a demo or template.
Contributions should prioritize:
- Reliability
- Maintainability
- Clear user value

---

## Development Setup

### Prerequisites
- Node.js **v20+**
- pnpm
- PostgreSQL (local or hosted)

### Local Setup
```bash
git clone https://github.com/urjitc/thinkex.git
cd thinkex
pnpm install
cp .env.example .env.local
pnpm db:push
pnpm dev

# YellowShifts Monorepo Foundation (Phase 1)

Modern, production-grade monorepo foundation for **YellowShifts** built with:

- **Turborepo** build system & task runner
- **pnpm workspaces** package management
- **Next.js 16 App Router**
- **TypeScript strict mode**
- **Supabase** backend / database client architecture
- **Design Tokens** extracted directly from legacy station brand palette
- **RTL-First** Heebo/Ubuntu typography & localization dictionary
- **Zero-Emoji Policy** with modern vector iconography (@hugeicons / lucide)

---

## Monorepo Architecture

```
PazShifts/
├── apps/
│   ├── web/                     # Worker & Shift Manager station operational portal (:3000)
│   └── admin/                   # Platform Admin & Station Administration portal (:3001)
├── packages/
│   ├── ui/                      # Semantic design tokens & accessible primitives
│   ├── types/                   # Multi-station authorization types & Supabase contracts
│   ├── database/                # Supabase SSR client/server helpers & admin factory
│   ├── i18n/                    # RTL-first translation dictionaries & typed key accessor
│   ├── icons/                   # Zero-emoji vector iconography system
│   └── config/                  # Shared TypeScript, ESLint & Prettier configs
├── turbo.json                   # Turborepo task pipeline
└── pnpm-workspace.yaml          # Workspace definitions
```

---

## Authorization & Multi-Station Hierarchy

YellowShifts implements strict role separation:

1. **Platform Admin**: Global system account (`platform_admins` table). NOT attached to any single station. Manages all stations, system configuration, and audit logs.
2. **Station Admin**: Station-scoped administrator (`station_memberships.role = 'ADMIN'`). Strictly isolated to assigned station(s) via PostgreSQL Row Level Security (RLS).
3. **Shift Manager**: Station-scoped operational manager.
4. **Worker / Employee**: Station-scoped employee.

---

## Zero Mock Data Philosophy

This codebase strictly forbids fake mock records or local placeholder arrays. All data layer abstractions interface directly with Supabase via `@yellowshifts/database`.

---

## Quickstart & Commands

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Installation

```bash
pnpm install
```

### Development

```bash
# Run both web and admin apps concurrently
pnpm dev

# Or run individual apps:
pnpm --filter @yellowshifts/web dev
pnpm --filter @yellowshifts/admin dev
```

### Quality & Verification Gates

```bash
# Build all packages and applications
pnpm build

# Typecheck all packages and applications (strict TypeScript)
pnpm typecheck

# Lint all packages and applications
pnpm lint

# Format check with Prettier
pnpm format
```

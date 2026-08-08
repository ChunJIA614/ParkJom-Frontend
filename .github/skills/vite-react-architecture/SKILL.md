---
name: vite-react-architecture
description: Enforce maintainable architecture in Vite, React, and TypeScript applications. Use when creating, moving, refactoring, or reviewing frontend files; separating shared and feature code; extracting hooks or API access; or cleaning obsolete project files.
---

# Vite React TypeScript Architecture

Classify every file as app-level, shared, or feature-specific before creating or moving it. Preserve behavior and public routes while improving boundaries.

## Structure

Use only directories the project needs:

```text
src/
  app/                    # application shell, routes, and providers
  assets/                 # source-controlled assets imported by code
  components/
    ui/                   # reusable, application-independent primitives
    layout/               # shared application chrome and layout
    common/               # shared domain-aware components
  features/<feature>/
    api/                  # feature-owned requests and adapters
    components/           # feature-owned UI
    hooks/                # feature-owned behavior
    pages/                # route-level feature screens
    types/                # split only when one types file becomes substantial
  hooks/                  # reusable cross-feature hooks
  lib/                    # framework-neutral shared utilities
  services/               # global clients and integrations
  types/                  # global and ambient types
  utils/                  # small cross-feature helpers
  main.tsx
```

Do not create empty directories to mirror the template.

## Placement Rules

- Place reusable, application-independent UI in `src/components/ui/`.
- Place shared headers, navigation, shells, and layout in `src/components/layout/`.
- Place shared domain-aware components in `src/components/common/`.
- Place feature-specific UI, hooks, API code, data, libraries, pages, and types inside `src/features/<feature>/`.
- Place reusable hooks in `src/hooks/` and global client configuration in `src/services/`.
- Keep API calls and persistence logic out of React render components; extract them to feature `api/`, feature hooks, or global services.
- Keep application composition, providers, and route guards in `src/app/`.
- For a substantial component, use a component folder containing its implementation, tests, types, and `index.ts`. Keep small single-file components flat.

## Dependency Boundaries

- Allow `app` to compose features and shared modules.
- Allow features to import from shared components, global hooks, services, types, utilities, and their own feature.
- Do not import another feature's internal component, hook, or API module. Promote truly shared code first.
- Do not let shared modules import from `features` or `app`.
- Prefer direct imports unless a deliberate public `index.ts` boundary improves clarity.
- Prevent circular imports and preserve lazy route boundaries.

## Refactor Workflow

1. Inventory source files, import paths, aliases, assets, tests, and build configuration.
2. Build an exact old-to-new path map before moving files.
3. Move shared and feature modules in small coherent groups and update every import immediately.
4. Search for stale paths, duplicate implementations, dead exports, and feature logic left in shared directories.
5. Delete a file only after confirming it is generated, duplicated, obsolete, or unreachable from code and configuration.
6. Keep deployment secrets, environment files, user data, and unfamiliar assets unless their disposal is explicitly authorized and verified.
7. Run type-checking, tests when present, a production build, and a final stale-import search.

## Cleanup Rules

- Ignore or remove generated output such as `dist/` from source control when the deployment workflow rebuilds it.
- Remove empty placeholder directories and obsolete duplicate files.
- Do not delete configuration, content, fixtures, or public assets solely because a text import search finds no match; inspect framework and deployment references first.
- Report every material deletion and whether it can be regenerated.

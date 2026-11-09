# Project organization

ParkJom uses a feature-based React application with a single Vite build. The same `dist/` output is deployed to Firebase Hosting and copied into the Capacitor Android and iOS projects.

## File placement

- `src/app/`: application composition, routes, providers, styles, and theme.
- `src/features/<feature>/`: feature-owned pages, components, API adapters, context, and helpers. Keep a feature's code together; create subfolders only when needed.
- `src/components/`: shared UI primitives, layouts, and domain-aware common components. The shared modal provider lives in `common/`.
- `src/hooks/`, `src/lib/`, `src/services/`, and `src/types/`: shared hooks, framework-neutral helpers, integrations, and global declarations.
- `public/`: assets that must be served at stable URLs, including branding, PWA metadata, and dynamically selected hero frames. Imported assets can live beside the feature that owns them.
- `android/` and `ios/`: native source projects. Keep these in version control; their build outputs and copied web bundles are generated.
- `tests/`: automated regression checks. Run from the repository root with `npm test`.
- `scripts/`: the native sync hook and hero-frame maintenance tools. Run from the repository root.
- `docs/`: current build instructions. `docs/archive/` holds historical reports and inactive backend workflow examples.

The landing hero belongs to `features/landing/components/`. Notifications follow the same `api/`, `components/`, `context/`, `lib/`, and `pages/` organization as the rest of the app. `features/notifications/index.ts` preserves the feature's existing public exports.

## Checks and dependencies

Use Node.js 22 or newer and install the locked dependencies with `npm ci`. Run `npm run check` before publishing: it type-checks the app, runs the regression checks, and builds the production web bundle. `npm run lint` remains an alias for type checking; an ESLint ruleset is not configured.

Build tools, type declarations, the component generator, and test tooling are development dependencies. Libraries imported by application code are runtime dependencies. `esbuild` is declared directly because the regression checks import it.

Frontend CI runs the same checks on pull requests and pushes to `main`. The archived .NET jobs referenced backend projects that are absent from this repository, so they are no longer active deployment workflows.

## Cleanup decisions

The 9 November 2026 cleanup traced static and lazy imports from `src/main.tsx` and checked configuration and script references before deleting files.

Removed unused source files:

- `components/layout/WorkspaceSidebar.tsx`: unused compatibility re-export of `AppSidebar`.
- `components/ui/alert-dialog.tsx`, `badge.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, and `tabs.tsx`: unused generated UI primitives.
- `features/admin/components/ReviewModeration.tsx` and `SupportDispute.tsx`: disconnected screens with no route or importing component.
- `hooks/useNotifications.ts` and `services/notificationApi.ts`: unused notification implementation superseded by the active notifications feature.

Removed the root `parkjom-logo.png` and `src/assets/logo.png` only after verifying they were byte-identical to `public/branding/parkjom-logo.png` and unused. Native icon copies remain because their platform asset catalogs reference them. Responsive hero frame sets also remain: they are separate resolution variants selected at runtime.

Removed 17 one-time source-rewrite scripts named `append-*`, `apply-*`, `patch-*`, `remove-iframe-rule.mjs`, and `set-google-outline.mjs`. They were not part of any package command or build process. Their changes are already represented in source control; rerunning the old replacements could damage current code.

Removed the obsolete nested `src/.gitignore`; the root ignore file and platform ignore files cover generated files. Empty `state/`, `src/assets/`, and `src/contexts/` folders were removed. Local environment files, local design originals, and the master video were preserved.

All deleted tracked files can be recovered from Git history. Historical browser diagnostics remain in `scripts/archive/`; they are not the automated test suite and may require their original browser paths, server ports, and fixtures.

## Reference conventions

This layout follows [Vite's static asset conventions](https://vite.dev/guide/assets), [Capacitor's build-and-sync workflow](https://capacitorjs.com/docs/basics/workflow), and [npm's dependency categories](https://docs.npmjs.com/specifying-dependencies-and-devdependencies-in-a-package-json-file/). Feature folder names are a project convention, not a requirement imposed by React.

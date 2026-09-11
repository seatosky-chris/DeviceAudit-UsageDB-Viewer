# Agent Instructions

## Project

- This is a Vue 3 + TypeScript + Vite single-page frontend for Azure Static Web Apps.
- Node.js `24.x` is required. The project uses ESM and strict TypeScript.
- The app currently has no router, state manager, API, or client-side authentication.

## Development

- Install dependencies with `npm install`.
- Start local development with `npm run dev`.
- Validate a production build with `npm run build`; this runs `vue-tsc --noEmit` before `vite build`.
- Preview the built output with `npm run preview`.
- No test, lint, or format scripts are configured. Do not claim those checks passed unless they are added and run.

## Code Boundaries

- `src/main.ts` mounts the app and imports global styles.
- `src/App.vue` owns the current page markup and component behavior.
- `src/styles.css` contains the global reset, layout, typography, and visual styles.
- Keep the existing semicolon-free TypeScript style and strict typing. Follow nearby Vue patterns before introducing new abstractions.
- Do not add authentication logic to Vue components: production access control is configured by Static Web Apps.

## Azure Static Web Apps

- Deployment is defined in [.github/workflows/azure-static-web-apps-salmon-sea-066f5121e.yml](.github/workflows/azure-static-web-apps-salmon-sea-066f5121e.yml) and targets pushes and pull requests on `master`.
- The workflow builds the repository root and deploys `dist/`; it has no API deployment. Keep changes compatible with Vite's output.
- Review [public/staticwebapp.config.json](public/staticwebapp.config.json) before changing routes, assets, redirects, or SPA fallback behavior. The site and `/assets/*` require the `viewer` or `administrator` roles, and GitHub login is blocked.
- Local Vite development does not reproduce the production authentication boundary. Follow the access and deployment notes in [README.md](README.md).
- New data access requires an explicitly introduced backend or external service; do not assume an API already exists.
- Do not claim Azure authentication or VS Code integrated-browser launch behavior is validated by `npm run dev`; those require the deployed Azure environment or a verified VS Code launch configuration.

## Change Validation

- For source changes, run `npm run build` at minimum.
- For route or authentication configuration changes, inspect the generated `dist/` output and verify the relevant Static Web Apps configuration alongside the build.
- Keep changes focused and avoid modifying generated `dist/` or dependency files unless the task requires it.
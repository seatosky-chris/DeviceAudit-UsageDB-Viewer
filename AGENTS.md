# Agent Instructions

## Project

- This is a Vue 3 + TypeScript + Vite single-page frontend with an Azure Functions API in `api/`, deployed through Azure Static Web Apps.
- Node.js `24.x` is required. Both packages use ESM and strict TypeScript.
- The frontend uses hash-based navigation in `src/App.vue`; it has no Vue Router or state manager, and must not implement authentication.

## Development

- Install frontend dependencies with `npm install` and API dependencies with `npm --prefix api install`.
- Use the **Launch Full Stack (Vue + API)** compound in [.vscode/launch.json](.vscode/launch.json) for local end-to-end development. Vite proxies `/api` to the Functions host at `http://localhost:7071` via [vite.config.ts](vite.config.ts).
- Build the frontend with `npm run build` (`vue-tsc --noEmit` then `vite build`) and the API with `npm --prefix api run build`.
- The API launch configuration builds before starting Functions Core Tools. Local API development requires Azure Functions Core Tools and the appropriate local settings; restart the Functions host after changing those settings.
- `npm run preview` previews only the built frontend. No test, lint, or format scripts are configured; do not claim those checks passed unless they are added and run.

## Code Boundaries

- `src/main.ts` mounts the frontend; `src/App.vue` owns page state, API fetching, and hash navigation; `src/styles.css` owns global styles; `src/components/` contains typed UI components. Follow nearby Vue patterns and keep TypeScript semicolon-free.
- `src/components/EntityTable.vue` owns user/computer list behavior, including sorting; `src/components/UsageHistoryTable.vue` owns monthly activity history. For table changes, identify the component that owns the requested data and behavior before editing; don't implement entity-list behavior in the history table.
- `api/src/functions/getDatabases.ts` registers the database-list endpoint; `api/src/functions/usageEndpoints.ts` registers the entity and usage endpoints. These use the Node.js Azure Functions v4 code-based model. Do not add legacy `function.json` function definitions; mixing models can cause functions to be ignored during indexing.
- `api/getDatabases/index.js` loads the compiled API modules. API TypeScript compiles from `api/src` to generated `api/dist`; edit source, not generated output.
- `getDatabases.ts` uses `DefaultAzureCredential` for Azure Resource Graph. The current Static Web Apps Free setup configures `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` for the service principal; verify the hosting plan and actual settings before recommending a different credential flow, and don't assume managed identity is available.
- The app-registration Reader role is for Resource Graph metadata and does not grant Cosmos DB SQL data-plane access. Entity and usage endpoints get Cosmos resource tokens through the key broker, configured with `KEY_BROKER_URL` and `KEY_BROKER_API_KEY`; keep these authorization paths distinct when diagnosing access failures.
- The README's Resource Graph credential setup is not a complete list of API settings; verify requirements against the endpoint source. Do not read, expose, or modify secrets in `api/local.settings.json` unless explicitly requested.

## Azure Static Web Apps

- Deployment is defined in [.github/workflows/azure-static-web-apps-salmon-sea-066f5121e.yml](.github/workflows/azure-static-web-apps-salmon-sea-066f5121e.yml) and targets pushes and pull requests on `master`.
- The workflow builds the frontend from the repository root and deploys the API from `api/`; keep changes compatible with both outputs.
- Review [public/staticwebapp.config.json](public/staticwebapp.config.json) before changing routes, assets, redirects, or SPA fallback behavior. The site, `/assets/*`, and `/api/*` require the `viewer` or `administrator` roles; GitHub login is blocked.
- Functions are registered with `authLevel: "anonymous"`; deployed Static Web Apps route rules enforce app access. Local Vite and Functions do not reproduce that role boundary, so do not treat local access as an authentication test or add frontend authentication as a substitute.
- Follow the access and deployment notes in [README.md](README.md). Do not claim Azure authentication or VS Code integrated-browser behavior is validated by a production build; those require the deployed Azure environment or a verified launch configuration.

## Change Validation

- After a Vue edit, run `npm run build` before making follow-on changes; fix any type or template compilation errors in the touched slice first. For API changes, run `npm --prefix api run build`. Run both when changing both packages.
- For route or authentication configuration changes, inspect the generated `dist/` output and verify the relevant Static Web Apps configuration alongside the build.
- Keep changes focused and avoid modifying generated `dist/`, `api/dist/`, or dependency files unless the task requires it.
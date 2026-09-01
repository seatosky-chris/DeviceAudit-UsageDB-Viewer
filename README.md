# DeviceAudit UsageDB Viewer

A Vue 3 and TypeScript frontend designed for Azure Static Web Apps.

## Run locally

Requires Node.js 24.

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

The production files are generated in `dist/`.

## Deploy to Azure Static Web Apps

The GitHub Actions workflow at `.github/workflows/azure-static-web-apps.yml` builds and deploys the app when changes are pushed to `main`. Add the deployment token supplied by Azure to the repository secret named `AZURE_STATIC_WEB_APPS_API_TOKEN`.

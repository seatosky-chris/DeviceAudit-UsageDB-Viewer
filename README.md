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

The GitHub Actions workflow at `.github/workflows/azure-static-web-apps-salmon-sea-066f5121e.yml` builds and deploys the app when changes are pushed to `master`. Azure creates the repository secret named `AZURE_STATIC_WEB_APPS_API_TOKEN_SALMON_SEA_066F5121E` during provisioning.

## Access control (Free plan)

The whole site requires a Microsoft Entra sign-in and either the `viewer` or
`administrator` Static Web Apps role. GitHub sign-in is disabled.

To grant a person access in the Azure portal:

1. Open this Static Web Apps resource.
2. Select **Settings** > **Role Management** > **Invite**.
3. Select **Azure Active Directory**, enter the person's work email address, and assign `viewer` or `administrator`.
4. Generate the invitation and send the link to that person. They must sign in with the invited Microsoft account to activate the assignment.

The Free plan uses Azure's preconfigured Entra provider. The invitation and role requirement protect the site, but do not prevent an external Microsoft account from reaching the sign-in screen. For tenant-only sign-in or Entra group-based role assignment, upgrade to the Standard plan and configure a custom Entra provider.

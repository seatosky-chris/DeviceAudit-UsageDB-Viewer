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

## Required environment variables (API)

The API endpoint (`/api/getDatabases`) uses Azure Resource Graph via `DefaultAzureCredential`.

### 1) Create an App Registration (service principal)
1. In the Azure Portal, go to **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name the app (e.g. `DeviceAudit-UsageViewer-SWA-Backend`) and keep the supported account type as appropriate for your tenant.
3. After creation:
   - Copy **Directory (tenant) ID** → set as `AZURE_TENANT_ID`.
   - Copy **Application (client) ID** → set as `AZURE_CLIENT_ID`.
4. Create a **Client secret** (Certificates & secrets → New client secret): copy the **Value** immediately.
   - Set the copied secret value as `AZURE_CLIENT_SECRET`.

### 2) Grant Reader permissions
Assign the app registration **Reader** access so it can query metadata for the Cosmos DB accounts.

- Go to the Azure **Resource Group** that contains your Cosmos DB accounts (the one whose databases follow `stats-*`).
- Select **Access control (IAM)** → **Add role assignment**.
- Choose role **Reader**.
- Select the app registration/service principal you created (e.g. `DeviceAudit-UsageViewer-SWA-Backend`).

> If you prefer least privilege, you can further scope permissions, but `Reader` on the Cosmos DB resource group is the simplest starting point.

### 3) Configure Static Web Apps application settings
Set these **application settings** in the Static Web App (Functions) environment:

- `AZURE_TENANT_ID` — your Entra tenant ID
- `AZURE_CLIENT_ID` — the App Registration (service principal) client ID
- `AZURE_CLIENT_SECRET` — the App Registration client secret value

Locally, you can put these in `api/local.settings.json`.

### ITGlue device links

Set `ITGLUE_BASE_URL` to an ITGlue URL containing the organization ID
placeholder `{organizationID}`. The API reads the customer's `ITGOrgID` from
the Cosmos DB `Variables` container using the Key Broker's `variables` token.
It selects the collection by entity type, then appends the ITGlue ID. For example,
either of these settings is accepted:

```text
ITGLUE_BASE_URL=https://contoso.itglue.com/{organizationID}/configurations/
ITGLUE_BASE_URL=https://contoso.itglue.com/{organizationID}/contacts/
```

Computer links use `configurations` and user links use `contacts`, regardless
of which collection appears in the setting. For example, with organization ID
`300`, a computer ID of `208` links to
`https://contoso.itglue.com/300/configurations/208`, while a user ID of `501`
links to `https://contoso.itglue.com/300/contacts/501`. ITGlue links are omitted
when the setting is missing or the customer's `ITGOrgID` cannot be retrieved.

# InsightIQ Azure App Service Deployment

This project can be deployed to Azure App Service without changing the current architecture:

- `frontend`: React + Vite, served as a Node.js web app that hosts the built `dist` output.
- `backend`: Node.js + Express API.

The recommended topology is two separate App Service apps:

- `insightiq-web`
- `insightiq-api`

Both apps should use a supported Node.js LTS runtime. The project `package.json` files accept `20.x`, `22.x`, or `24.x`.

## Files Added for App Service Support

- `backend/.env.example`
- `backend/services/cors.js`
- `frontend/.env.example`
- `frontend/server.cjs`

## Backend Support

The backend already listened on `process.env.PORT`. The App Service support adds:

- `npm start` and `npm run start:azure`
- `/health` endpoint for App Service health checks
- environment-driven CORS through `CORS_ALLOWED_ORIGINS`

Recommended backend app settings:

```text
NODE_ENV=production
GEMINI_API_KEY=<your key>
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-2.0-flash
GEMINI_MAX_RETRIES_PER_MODEL=2
AZURE_STORAGE_CONNECTION_STRING=<your storage connection string>
AZURE_STORAGE_CONTAINER_NAME=insightiq-datasets
CORS_ALLOWED_ORIGINS=https://<frontend-app>.azurewebsites.net
SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

Health check path:

```text
/health
```

## Frontend Support

The frontend now includes a small Node.js static server for App Service:

- `npm start` and `npm run start:azure`
- SPA route fallback to `index.html`
- `/health` endpoint
- runtime configuration via `/app-config.js`

The frontend can read the backend URL in two ways:

1. Build time via `VITE_API_BASE_URL`
2. Runtime via `INSIGHTIQ_API_BASE_URL`

Runtime configuration is preferred for App Service because the backend hostname can change without rebuilding the React bundle.

Recommended frontend app settings:

```text
NODE_ENV=production
INSIGHTIQ_API_BASE_URL=https://<backend-app>.azurewebsites.net
WEBSITE_RUN_FROM_PACKAGE=1
```

Optional local or CI build-time variable:

```text
VITE_API_BASE_URL=https://<backend-app>.azurewebsites.net
```

Health check path:

```text
/health
```

## Recommended Deployment Flow

### 1. Backend

From the `backend` folder:

```powershell
Compress-Archive `
  -Path (Get-ChildItem -Force | Where-Object { $_.Name -notin @("node_modules", ".env") } | ForEach-Object { $_.FullName }) `
  -DestinationPath ..\backend-appservice.zip `
  -Force
```

Deploy the ZIP to the backend App Service:

```powershell
az webapp deploy `
  --resource-group <resource-group> `
  --name <backend-app-name> `
  --src-path .\backend-appservice.zip
```

Set the backend startup command to:

```text
npm start
```

Because the backend is deployed from source, App Service build automation should remain enabled through `SCM_DO_BUILD_DURING_DEPLOYMENT=true` so Azure installs production dependencies during deployment.

### 2. Frontend

Build the frontend first:

```powershell
cd frontend
npm install
npm run build
```

Create the deployment ZIP from the `frontend` folder after the build completes:

```powershell
Compress-Archive `
  -Path .\dist, .\server.cjs, .\package.json `
  -DestinationPath ..\frontend-appservice.zip `
  -Force
```

Deploy the ZIP to the frontend App Service:

```powershell
az webapp deploy `
  --resource-group <resource-group> `
  --name <frontend-app-name> `
  --src-path .\frontend-appservice.zip
```

Set the frontend startup command to:

```text
npm start
```

## Runtime Configuration Notes

- The backend uses App Service application settings directly through `process.env`.
- The frontend serves `app-config.js` at runtime, so `INSIGHTIQ_API_BASE_URL` can be changed in App Service without rebuilding the React app.
- If you deploy a prebuilt frontend ZIP, the `dist` folder must be present in the package.
- The backend and frontend intentionally use different deployment modes:
  - backend: source ZIP plus App Service build automation
  - frontend: prebuilt ready-to-run ZIP plus `WEBSITE_RUN_FROM_PACKAGE=1`

## Validation Checklist

After deployment, verify:

1. `https://<backend-app>.azurewebsites.net/health` returns `status: ok`
2. `https://<frontend-app>.azurewebsites.net/health` returns `status: ok`
3. The frontend can load dataset status from the backend
4. Upload, query, Business Copilot, workspace isolation, and root-cause analysis all still work
5. Azure Blob uploads still succeed when storage settings are configured

## Azure Runtime Notes

- For Linux App Service, set the runtime stack to a supported Node.js LTS such as `NODE|24-lts` or `NODE|22-lts`.
- For Windows App Service, use a supported `WEBSITE_NODE_DEFAULT_VERSION` such as `~24`.
- Use App Service application settings instead of committing secrets into `.env`.

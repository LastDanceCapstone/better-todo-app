# Prioritize Backend - Deployment Documentation

**Author:** London Haith  
**Date:** January 30, 2026  
**Status:**  Production Deployed

---

## Table of Contents

1. [Overview](#overview)
2. [What Was Done](#what-was-done)
3. [Architecture](#architecture)
4. [Getting Started](#getting-started)
5. [Google Authentication and iOS Development Setup](#google-authentication-and-ios-development-setup)
6. [Development Workflow](#development-workflow)
7. [Deployment Process](#deployment-process)
8. [Troubleshooting](#troubleshooting)
9. [Key Decisions](#key-decisions)

---

## Overview

The Prioritize backend is a production-ready Node.js/Express API deployed on **Railway** with a **PostgreSQL database**. The API provides full task management functionality with authentication, real-time data persistence, and comprehensive API documentation through Swagger.

### Key Features Deployed:
-  User authentication (JWT-based)
-  Task management (CRUD operations)
-  Subtask management with status tracking
-  Priority levels and timestamps
-  Database migrations and schema versioning
-  Comprehensive error handling
-  CORS enabled for frontend integration
-  Swagger/OpenAPI documentation
-  Health check endpoints
-  Production logging and monitoring

### Live URL:
```
https://prioritize-production-3835.up.railway.app
```

---

## What Was Done

### Story 1: Initialize Hosted PostgreSQL Database

#### Problem We Solved
We needed a production database that:
-  Persists data permanently (not local development database)
-  Is accessible from anywhere (not just local network)
-  Scales automatically as the app grows
-  Has built-in backups and security

#### Solution: Railway PostgreSQL

**Steps Taken:**

1. **Set up Railway Project**
   - Created account at railway.app
   - Created project "prioritize-backend-deployment"
   - Provisioned PostgreSQL database via Railway dashboard

2. **Configured Database Connection**
   - Got database credentials from Railway
   - Added `DATABASE_URL` environment variable to `.env`:
     ```
     DATABASE_URL="postgresql://postgres:PASSWORD@trolley.proxy.rlwy.net:59975/railway"
     ```
   - This URL connects the local backend to the hosted database

3. **Applied Database Migrations**
   - Created Prisma schema defining tables: `users`, `tasks`, `subtasks`
   - Generated 2 migrations:
     - `20251105060459_init` - Initial schema creation
     - `20260128214710_update_schema` - Enhanced with timestamps and enums
   - Ran migrations on hosted database: `npx prisma migrate deploy`
   - Result: Database ready with all required tables and relationships

4. **Verified Schema**
   - Confirmed all tables exist and are accessible
   - Tested foreign key relationships
   - Verified Prisma Client can communicate with database

**Result:**
-  Production database running on Railway
-  All migrations applied successfully
-  Schema matches Prisma models
-  Database accessible from anywhere with internet

---

### Story 2: Deploy Backend API

#### Problem We Solved
We needed the backend to be:
-  Always available (24/7 uptime)
-  Accessible from the internet (not just local machine)
-  Auto-deploy on code changes (if using GitHub)
-  Have proper error tracking and logs

#### Solution: Railway Deployment

**Steps Taken:**

1. **Prepared Code for Production**

   a. **Updated package.json scripts:**
   ```json
   {
     "build": "npx prisma generate && tsc",
     "start": "node dist/index.js",
     "db:migrate": "prisma migrate deploy"  // For production
   }
   ```
   - Build script generates Prisma client and compiles TypeScript
   - Start script runs the compiled JavaScript (not TypeScript)
   - Migration script uses `deploy` for production (not `dev`)

   b. **Created deployment configuration files:**

   **`railway.json`** - Railway-specific deployment config:
   ```json
   {
     "build": {
       "builder": "NIXPACKS",
       "buildCommand": "npm install && npx prisma generate && npm run build"
     },
     "deploy": {
       "startCommand": "npm start",
       "healthcheckPath": "/health",
       "healthcheckTimeout": 100,
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```
   - Tells Railway how to build and run our app
   - Configures health checks (Railway pings `/health` every 30s)
   - Auto-restarts if container crashes

   **`nixpacks.toml`** - Build environment setup:
   ```toml
   [phases.setup]
   nixPkgs = ["nodejs-18_x"]
   
   [phases.install]
   cmds = ["npm ci --include=dev"]
   
   [phases.build]
   cmds = ["npx prisma generate", "npm run build"]
   
   [start]
   cmd = "npm start"
   ```
   - Specifies Node.js version (18.x)
   - Installs dependencies
   - Generates Prisma Client
   - Compiles TypeScript to JavaScript
   - Starts the app

   c. **Created `.railwayignore`** to exclude unnecessary files:
   ```
   node_modules
   .env
   .git
   dist
   *.md
   ```

2. **Set Up Environment Variables on Railway**

   Added in Railway dashboard under Variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - Secret for signing JWT tokens
   - `NODE_ENV` - Set to "production"
   - `PORT` - Auto-configured by Railway (3000)

3. **Deployed to Railway**

   Used Railway CLI:
   ```bash
   railway login                    # Authenticate with Railway
   railway init                     # Initialize project
   railway up                       # Deploy to production
   railway domain                   # Generate public URL
   ```

   **Deployment Process:**
   - Railway downloads code from GitHub/local directory
   - Builds Docker image using nixpacks
   - Generates Prisma Client on the server
   - Compiles TypeScript to JavaScript
   - Starts Node.js process running `npm start`
   - Health check passes (GET /health returns 200)
   - API is now live and accessible

4. **Generated Public Domain**

   ```bash
   railway domain
   ```
   Output:
   ```
    https://prioritize-production-3835.up.railway.app
   ```

5. **Verified All Endpoints**

   **Health Check:**
   ```bash
   curl https://prioritize-production-3835.up.railway.app/health
   ```
   Response: `{"status": "ok", "message": "Prioritize API is running"}`

   **Swagger Documentation:**
   ```
   https://prioritize-production-3835.up.railway.app/api/docs
   ```

   **API Endpoints Tested:**
   -  User registration (`POST /api/register`)
   -  User login (`POST /api/login`)
   -  Task creation (`POST /api/tasks`)
   -  Task retrieval (`GET /api/tasks`)
   -  Subtask operations (create, update, delete)

**Result:**
-  Backend running 24/7 on Railway
-  Public URL accessible from anywhere
-  Auto-restarts on failure
-  All endpoints working in production
-  Logs visible in Railway dashboard

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Mobile App                         │
│                  (React Native/Expo)                    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ HTTPS
                  │
┌─────────────────▼───────────────────────────────────────┐
│              Railway (Hosting)                          │
│  ┌─────────────────────────────────────────────────────┤
│  │                                                      │
│  │  Express Server (Node.js)                           │
│  │  ├─ Authentication Routes (/api/register, /login)  │
│  │  ├─ Task Routes (/api/tasks)                       │
│  │  ├─ Subtask Routes (/api/subtasks)                 │
│  │  ├─ Health Check (/health)                         │
│  │  └─ Swagger UI (/api/docs)                         │
│  │                                                      │
│  │  PostgreSQL Database                                │
│  │  ├─ users table                                     │
│  │  ├─ tasks table                                     │
│  │  └─ subtasks table                                  │
│  │                                                      │
│  └─────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- **Runtime:** Node.js 18
- **Framework:** Express.js 5
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** JWT (jsonwebtoken)
- **API Documentation:** Swagger/OpenAPI
- **Security:** CORS, Helmet, bcrypt (password hashing)

**Deployment:**
- **Platform:** Railway
- **Build:** Nixpacks (Docker-based)
- **Environment:** Production

### Database Schema

```
┌──────────────┐
│    users     │
├──────────────┤
│ id (CUID)    │◄─────┐
│ email        │      │
│ password     │      │
│ firstName    │      │
│ lastName     │      │
│ createdAt    │      │
│ updatedAt    │      │
└──────────────┘      │
                      │
┌──────────────┐      │ (userId FK)
│    tasks     │      │
├──────────────┤      │
│ id (CUID)    │      ├─────────
│ title        │      
│ description  │      
│ status       │ ┐
│ priority     │ │
│ dueAt        │ │
│ completedAt  │ ├─── Enhanced with
│ statusChanged│ │     new timestamps
│ createdAt    │ │
│ updatedAt    │ │
│ userId       │─┘
└──────────────┘
       │
       │ (taskId FK)
       │
┌──────────────┐
│   subtasks   │
├──────────────┤
│ id (CUID)    │
│ title        │
│ description  │
│ status       │ ◄─ Enhanced enum
│ completedAt  │
│ createdAt    │
│ updatedAt    │
│ taskId       │
└──────────────┘
```

**Enums:**
- `TaskStatus`: TODO, IN_PROGRESS, COMPLETED, CANCELLED
- `TaskPriority`: LOW, MEDIUM, HIGH, URGENT
- `SubtaskStatus`: TODO, IN_PROGRESS, COMPLETED, CANCELLED

---

## Getting Started

### Prerequisites

```bash
# Check Node.js version (need 16+)
node --version  # Should be v18.x or higher

# Check npm
npm --version   # Should be 8+

# Have Railway CLI installed
npm install -g @railway/cli

# Have EAS CLI installed (mobile development builds)
npm install -g eas-cli
```

### iOS Development Build Prerequisites

For iOS development builds with EAS:

1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. Create an Expo account (one-time):
   - Go to https://expo.dev/signup
   - Complete account registration
3. Authenticate with Expo/EAS:
   ```bash
   eas login
   ```
4. Build a development iOS app when needed:
   ```bash
   eas build --profile development --platform ios
   ```

Note: The platform flag is `ios` (not `io`).

### Initial Setup (One Time)

1. **Clone Repository**
   ```bash
   git clone https://github.com/LastDanceCapstone/better-todo-app.git
   cd better-todo-app/backend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   
   Create `.env` file in `backend/` directory:
   ```env
   DATABASE_URL="postgresql://postgres:PASSWORD@trolley.proxy.rlwy.net:59975/railway"
   JWT_SECRET="your-secret-key-here-change-in-production"
   NODE_ENV="development"
   PORT=3000
   ```

   **Get DATABASE_URL from Railway:**
   ```bash
   railway login
   railway link
   railway variables
   # Find DATABASE_URL variable and copy it
   ```

4. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

5. **Apply Migrations** (if connecting to existing Railway DB)
   ```bash
   npx prisma migrate deploy
   ```

6. **Verify Setup**
   ```bash
   npx ts-node test-db-connection.ts
   ```
   Expected output:
   ```
    Connection successful!
    Users table: 0 records
    Tasks table: 0 records
    Subtasks table: 0 records
   ```

### Build the Project

```bash
# Compile TypeScript to JavaScript
npm run build

# Output will be in dist/ directory
ls dist/
# dist/index.js
# dist/prisma.js
# dist/routes/
```

### Start the Server

**Development Mode (with hot reload):**
```bash
npm run dev
```
- Watches for file changes
- Restarts server automatically
- Good for local development

**Production Mode:**
```bash
npm start
```
- Runs compiled JavaScript
- No auto-reload
- Better performance

### Test the API

```bash
# Health check
curl http://localhost:3000/health

# View API documentation
open http://localhost:3000/api/docs

# Register a user
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Pass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Pass123!"
  }'
# Returns JWT token

# Create task (replace TOKEN with actual token)
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "title": "My Task",
    "description": "Task description",
    "priority": "HIGH",
    "status": "TODO"
  }'
```

---

## Google Authentication and iOS Development Setup

### Overview of the Feature

Google Authentication was added to Prioritize to reduce friction during onboarding and to provide users with an authentication option that aligns with modern mobile application expectations. While the existing email and password flow remains important for users who prefer traditional account creation, Google Sign-In offers a substantially faster path into the application because it eliminates manual credential creation, reduces password fatigue, and leverages an identity provider that many users already trust.

From an engineering perspective, the feature also improves the overall security posture of the application. Instead of asking every user to create and manage another password, the system can rely on Google's identity verification and then issue its own JWT for application-level authorization. This preserves Prioritize's existing backend session model while allowing authentication to begin from a secure third-party identity provider. The result is a better user experience, lower sign-up friction, and a more contemporary authentication flow suitable for a production-ready capstone product.


### Transition to Native Google Sign-In

After the redirect-based flow failed, the implementation was reoriented toward the native Google Sign-In SDK using `@react-native-google-signin/google-signin`. This was the correct decision for two reasons. First, it aligns with how Google expects native mobile apps to authenticate users. Second, it fits the realities of Expo development builds, where native modules can be compiled into the application and invoked directly instead of depending on browser redirects.

This transition changed the responsibility of the mobile application. Instead of opening a browser session and waiting for a redirect, the application now calls the native Google Sign-In module, allows the user to authenticate through the Google account picker, receives an ID token from the SDK, and sends that token to the Prioritize backend for verification. That design is cleaner and more robust because it separates responsibilities properly: Google handles identity, the native app handles token acquisition, and the backend handles verification plus application session creation.

In the final implementation, a dedicated helper file, `mobile/src/config/googleSignIn.ts`, centralizes Google Sign-In configuration and behavior. This helper configures the SDK one time, extracts the returned ID token safely, and maps known SDK errors such as user cancellation, concurrent sign-in attempts, and service unavailability into readable application-level messages. Centralizing this logic reduced duplication in the UI layer and made the sign-in process easier to maintain.

### iOS Development Setup and Native Testing Requirements

Implementing Google Sign-In on iOS required significantly more setup than a purely JavaScript-based feature. Because the application depends on native modules and Apple platform signing rules, it was necessary to work within the Apple Developer ecosystem rather than relying exclusively on Expo Go. This introduced several operational requirements that became part of the engineering process.

The project required enrollment in the Apple Developer Program so that the application could be built, signed, and installed on a physical iPhone as a proper development build. During setup, several expected iOS development issues emerged. These included missing code-signing certificates, device registration requirements, and the need to ensure that Developer Mode was enabled on the iPhone. These are not application logic problems, but they are essential deployment prerequisites when native iOS testing is involved.

Expo Application Services (EAS) was used to manage these build requirements. The key command for the mobile workflow became:

```bash
eas build --profile development --platform ios
```

This command generates a development build that includes the application's native modules, bundle identifier, URL schemes, and plugin-based iOS configuration. Once the build is completed and installed on the test device, the normal development loop continues through Metro using `npx expo start --dev-client`. This workflow is particularly important because Expo Go does not include arbitrary native modules, which means that any feature depending on a custom native dependency cannot be validated there.

### Native Module Integration Issue

One of the most important debugging milestones during implementation was the runtime error `RNGoogleSignin could not be found`. This error clearly indicated that the JavaScript code was correct enough to attempt a module call, but the native iOS application did not actually contain the compiled Google Sign-In module.

The root cause was that the native dependency had been installed in the JavaScript project, but the existing iOS build had been created before the module and its plugin configuration were added. In other words, the source code and the native application binary were out of sync. This is a common issue in Expo development when switching from a pure JavaScript feature to a native module.

The solution required two coordinated actions. First, the Google Sign-In config plugin had to be added to `mobile/app.json`, including the `iosUrlScheme` derived from the Google iOS client configuration. Second, the application had to be rebuilt through EAS so that the iOS binary would include the native Google Sign-In implementation. Once the plugin was registered and the build was recreated, the runtime module resolution error disappeared because the development build finally matched the codebase.

### Google Cloud Configuration

Correct Google Cloud configuration was critical to the success of the feature. The implementation required a clear understanding of the difference between the Google OAuth credentials involved, because several identifiers appear similar but serve different purposes.

The web client ID is primarily used when verifying the token audience on the backend and when configuring token issuance behavior in the mobile SDK. The iOS client ID identifies the native iOS application in Google's OAuth system and must correspond to the registered iOS app configuration. The reversed client ID, which typically begins with `com.googleusercontent.apps`, is used as the iOS URL scheme so that the native Google Sign-In flow can return control to the application correctly.

These values were surfaced to the mobile application through environment variables such as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, while the backend relied on `GOOGLE_CLIENT_ID` for token verification. The implementation highlighted an important engineering lesson: authentication failures are often caused not by faulty business logic, but by subtle configuration mismatches between cloud credentials, bundle identifiers, URL schemes, and environment variables.

### Frontend Integration

On the frontend, the Google Sign-In implementation was designed to preserve the existing authentication success flow while replacing only the token acquisition mechanism. The login screen continues to store the returned JWT under `authToken`, store the user payload under `user`, and navigate to the main application entry point once authentication succeeds. This preserved consistency with the existing email and password login flow and avoided unnecessary architectural churn.

The main change occurred inside the Google sign-in handler. Instead of invoking `expo-auth-session`, the login screen now calls the native helper exported from `googleSignIn.ts`. That helper configures the SDK, launches the native Google account flow, and returns a validated ID token. The login screen then sends that token to the backend endpoint at `POST /api/auth/google`.

An additional frontend improvement was the hardening of response parsing and error handling. During debugging, the frontend encountered a `JSON Parse error: Unexpected character: <`, which indicated that the backend was returning an HTML error page instead of JSON. To make the mobile application more resilient, the implementation was changed to read `response.text()` first, attempt JSON parsing manually, log the raw response for debugging, and show a user-friendly alert when parsing fails. This change made the client far more robust when backend deployments, routing issues, or infrastructure errors cause non-JSON responses.

### Backend Integration

On the backend, Google Authentication was implemented by adding a `POST /auth/google` route inside the authentication router. Because the router is mounted through `app.use('/api', authRoutes)`, the full external endpoint becomes `POST /api/auth/google`, which is the URL consumed by the mobile application.

The route accepts an `idToken` in the request body, validates that the token is present, and then verifies it through `google-auth-library` using `OAuth2Client`. The backend checks the token audience against `GOOGLE_CLIENT_ID`, validates the issuer, confirms that the token has not expired, and rejects unverified Google email accounts. Once the token is validated, the backend either finds the existing user by email or creates a new user record with the Google identity fields. After that, the backend generates the same style of JWT used by the rest of the Prioritize authentication system and returns a JSON response containing the token plus a normalized user payload.

This design is important because it keeps Google-specific verification on the server, where credentials and trust decisions belong. The mobile client never directly grants itself access; it only presents a Google-issued ID token. The backend remains the authority that validates identity and issues the application's own access token.

### Deployment Issue and Debugging Process

One of the most instructive problems in the implementation process occurred after the route had been added locally but the production environment still responded with `Cannot POST /api/auth/google`. At first glance, this appeared to suggest a coding error in the route definition or a mistake in the frontend URL. However, inspection of the backend showed that the route existed, the router export was correct, and the router mounting in `index.ts` was also correct.

The actual problem was deployment synchronization. Railway was still serving an older backend build that did not include the newly added Google authentication route. This is a subtle but common deployment issue in multi-service projects: local code may be correct, but the live environment can remain stale until the relevant service is rebuilt and redeployed.

The debugging process benefited from several strategies. The route was instrumented with a `console.log('Google auth route hit')` statement to provide positive confirmation in Railway logs when the endpoint is reached. The frontend was modified to log HTTP status, content type, and raw response text so that HTML error pages could be distinguished from valid JSON API responses. In addition, the backend deployment configuration was updated so that production startup runs `prisma migrate deploy` before launching the server. This was necessary because the Google authentication work introduced schema changes, and route behavior can fail indirectly if the production database has not been migrated to match the current Prisma schema.

From a deployment operations perspective, the project also reinforced how Railway behaves. Railway generally deploys from the connected GitHub repository and the branch configured in the Railway service settings. If the correct branch is not connected, or if local changes have not been pushed, production will continue serving the older revision. In cases where immediate deployment from local files is needed, the Railway CLI can also be used after linking the project, but Git-based deployment remains the standard team workflow.

### Final Working Authentication Flow

In the final production-ready design, the end-to-end flow is straightforward and well bounded. First, the user taps the Google Sign-In button in the mobile application. Second, the native Google Sign-In SDK opens the platform account flow and returns an ID token after successful authentication. Third, the mobile app sends that ID token to the Prioritize backend at `POST /api/auth/google`. Fourth, the backend verifies the token using Google's libraries and validates the account details. Fifth, the backend either creates the user or retrieves the existing account and then generates a Prioritize JWT. Finally, the backend returns the JWT and user payload, which the mobile app stores in `AsyncStorage` before navigating the user into the main application.

This flow achieves a clean separation of concerns. Google establishes identity, the backend authorizes access to the Prioritize system, and the mobile client simply orchestrates the user interaction and token exchange. That separation makes the implementation easier to reason about, easier to secure, and easier to evolve over time.

### Lessons Learned

This implementation produced several practical engineering lessons. The first is that native authentication on mobile should be approached as a platform integration problem, not just a frontend coding task. Browser-based OAuth patterns that work well on the web or in simplified demos do not always translate cleanly to native mobile applications. Choosing the correct SDK early can prevent significant rework.

The second lesson is that environment configuration is often just as important as application logic. Small mismatches in client IDs, URL schemes, bundle identifiers, or deployment variables can completely break a sign-in flow even when the underlying code is correct. Successful delivery therefore required disciplined verification of both source code and platform configuration.

The third lesson is that deployment and schema synchronization matter as much as route implementation. A backend endpoint can be written correctly and still fail in production if the service was not redeployed or if the production database was not migrated. This became particularly clear when diagnosing the `Cannot POST /api/auth/google` error.

Finally, the debugging process reinforced the value of defensive client behavior. Switching from a direct `response.json()` call to a text-first parsing approach made failures easier to diagnose and prevented the app from crashing on malformed responses. Combined with server-side logs, this created a much more reliable troubleshooting workflow.

### Future Improvements

Although the Google Sign-In feature is now functional and production-ready for the current capstone scope, several improvements would strengthen the system further. One future enhancement would be support for refresh tokens or longer-lived session renewal strategies so users do not need to sign in again as frequently. Another would be full Android support using the same backend verification model but platform-specific mobile configuration.

The error handling experience can also continue to improve. The current implementation already captures raw responses and avoids JSON parsing crashes, but future iterations could classify infrastructure failures, token verification failures, and misconfiguration problems more explicitly for both users and developers. In addition, login analytics could be added to measure adoption of email/password login versus Google Sign-In, providing evidence for product decisions in future releases.

Overall, the Google Authentication implementation represents more than a single new feature. It demonstrates the integration of cloud identity, native mobile tooling, backend verification, database evolution, and production deployment practices into one coherent workflow. That combination makes it a valuable case study within the Prioritize capstone project because it reflects the kinds of cross-stack engineering challenges that arise in real production systems.

---

## Development Workflow

### Daily Development Process

1. **Start Backend**
   ```bash
   cd backend
   npm run dev
   ```
   Server runs on `http://localhost:3000`

2. **Start Mobile App**
   ```bash
   cd mobile
   # Normal daily workflow after the dev build is installed
   npx expo start --dev-client
   ```
   Open the Prioritize development build on the simulator/device and connect to Metro.

   If the iOS development app is not installed yet, or if native iOS configuration changed, run:
   ```bash
   eas build --profile development --platform ios
   ```

   Use `eas build --profile development --platform ios` again when needed, including these cases:
   - the development app is not currently installed
   - an iOS simulator/device build is needed again
   - `app.json` scheme changed
   - iOS bundle identifier changed
   - native dependencies or plugins changed
   - OAuth native configuration changed

   Google Sign-In requires the development build, not Expo Go.
   - Expo Go uses `exp://` redirects.
   - Google rejects `exp://` redirects for this native OAuth flow.
   - Prioritize uses a custom redirect such as `prioritize://oauthredirect`.
   - Rebuild the app after changing `app.json` scheme, iOS bundle ID, or OAuth environment variables.

3. **Make Changes**
   - Edit TypeScript files in `src/`
   - Backend auto-reloads with `npm run dev`
   - Mobile app auto-reloads via Expo

4. **Test Changes**
   - Use Swagger UI: http://localhost:3000/api/docs
   - Or use mobile app simulator
   - Or use curl commands

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "Add feature X"
   git push origin london
   ```

### Making API Changes

**Example: Add new endpoint**

1. Create route handler in `src/routes/tasks.ts`:
   ```typescript
   router.get('/tasks/priority/:level', authenticateToken, async (req, res) => {
     const tasks = await prisma.task.findMany({
       where: { priority: req.params.level as TaskPriority },
     });
     res.json({ tasks });
   });
   ```

2. Test locally:
   ```bash
   curl http://localhost:3000/api/tasks/priority/HIGH \
     -H "Authorization: Bearer TOKEN"
   ```

3. Commit and push:
   ```bash
   git add src/routes/tasks.ts
   git commit -m "Add filter tasks by priority endpoint"
   git push
   ```

### Making Database Changes

**Example: Add new field to Task**

1. Update Prisma schema in `prisma/schema.prisma`:
   ```prisma
   model Task {
     // ... existing fields ...
     estimatedHours  Float?  // New field
   }
   ```

2. Create migration:
   ```bash
   npx prisma migrate dev --name add_estimated_hours
   ```
   - Creates migration file
   - Applies to local database
   - Updates Prisma Client

3. Update TypeScript types automatically (Prisma handles this)

4. Commit migration:
   ```bash
   git add prisma/migrations/
   git commit -m "Add estimatedHours field to tasks"
   git push
   ```

5. On production, migration runs automatically during deployment

---

## Deployment Process

### Preparing for Deployment

1. **Test Everything Locally**
   ```bash
   npm run build
   npm start
   # Verify all endpoints work
   ```

2. **Check Code Quality**
   ```bash
   # Compile TypeScript
   npx tsc -p tsconfig.json
   # Should have 0 errors
   ```

3. **Review Environment Variables**
   Make sure these are set in Railway:
   - `DATABASE_URL` 
   - `JWT_SECRET` 
   - `NODE_ENV=production` 

### Deploy to Production

**Option A: Using Railway CLI**

```bash
# From backend directory
cd backend

# Ensure you're linked to Railway project
railway link

# Deploy
railway up

# Watch deployment
railway logs --follow

# Get public domain (if not already assigned)
railway domain
```

**Option B: Using Railway Dashboard**

1. Go to https://railway.app
2. Select project
3. View deployments
4. Monitor logs in real-time

### Verify Deployment

```bash
# Health check
curl https://prioritize-production-3835.up.railway.app/health

# Check API documentation
open https://prioritize-production-3835.up.railway.app/api/docs

# Test endpoint
curl https://prioritize-production-3835.up.railway.app/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

### Rollback (if needed)

```bash
# View previous deployments
railway deployments

# Deploy specific version
railway deploy [DEPLOYMENT_ID]
```

---

## Troubleshooting

### Database Connection Issues

**Problem:** `Error: connect ECONNREFUSED`

**Solution:**
```bash
# 1. Check DATABASE_URL is set
echo $DATABASE_URL

# 2. Verify connection string format
# Should be: postgresql://user:pass@host:port/database

# 3. Test connection
npx ts-node test-db-connection.ts

# 4. If using Railway, ensure DATABASE_URL is in Railway variables
railway variables
```

### TypeScript Compilation Errors

**Problem:** `error TS2345: Argument of type 'X' is not assignable to type 'Y'`

**Solution:**
```bash
# 1. Regenerate Prisma types
npx prisma generate

# 2. Clear build cache
rm -rf dist

# 3. Rebuild
npm run build
```

### Port Already in Use

**Problem:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

### Migrations Failed in Production

**Problem:** `Deployment failed: prisma migrate deploy error`

**Solution:**
```bash
# 1. Check migration status locally
npx prisma migrate status

# 2. Verify migrations are in git
git status prisma/migrations/

# 3. If stuck, check Railway logs
railway logs --follow

# 4. Manual fix if needed:
# Contact database provider or manually run SQL
```

### Environment Variables Not Set in Production

**Problem:** `undefined is not a function` (JWT_SECRET not set)

**Solution:**
```bash
# 1. Check Railway variables
railway variables

# 2. If missing, add them
railway variables set JWT_SECRET="your-secret"

# 3. Redeploy
railway up

# 4. Verify in logs
railway logs
```

### Slow API Response in Production

**Problem:** First request takes 10+ seconds

**Solution:**
This is normal! Railway containers cold-start occasionally. After first request, they're fast. This is called "cold start" and is common with serverless platforms.

To minimize:
- Keep dependencies minimal
- Optimize database queries
- Consider Railway's paid plans for always-on containers

---

## Key Decisions

### Why Railway?

**Chosen for:**
-  Zero-config PostgreSQL setup
-  Simple environment variable management
-  Git-based deployments (push to deploy)
-  Built-in monitoring and logs
-  Affordable pricing for small projects
-  Fast deployment process
-  Good documentation

### Why Prisma ORM?

**Chosen for:**
-  Type-safe database queries (TypeScript)
-  Built-in migrations system
-  Auto-generated types from schema
-  Easy schema changes with migrations
-  Great development experience
-  Works with PostgreSQL seamlessly

### Why TypeScript?

**Chosen for:**
-  Catches errors at compile time
-  Better IDE support and autocomplete
-  Self-documenting code
-  Easier debugging
-  Scales well as codebase grows

### Why Express?

**Chosen for:**
-  Lightweight and fast
-  Large ecosystem of middleware
-  Easy to learn and maintain
-  Perfect for REST APIs
-  Great community support

### Why JWT Authentication?

**Chosen for:**
-  Stateless (no session storage needed)
-  Scales well with microservices
-  Works great with mobile apps
-  Standard in the industry
-  No database query needed for auth check

---

## Maintenance & Monitoring

### Regular Tasks

**Daily:**
- Check Railway logs for errors: `railway logs --follow`
- Monitor health endpoint

**Weekly:**
- Review database performance
- Check error logs for patterns

**Monthly:**
- Update dependencies: `npm update`
- Review security advisories: `npm audit`
- Backup database (Railway does this automatically)

### Performance Monitoring

```bash
# Check deployment status
railway status

# View resource usage
railway logs

# Check database connection count
# (via Railway dashboard -> Database service)
```

### Updates & Upgrades

**Update dependencies safely:**
```bash
# Check for updates
npm outdated

# Update with caution
npm update

# Test locally
npm run build
npm start

# Deploy
railway up
```

**Update Prisma:**
```bash
npm update @prisma/client prisma

# Regenerate client
npx prisma generate

# Test and deploy
npm run build
railway up
```

---

## Summary

This deployment represents:

1. **Scalable Architecture** - Backend separated from frontend, deployed independently
2. **Production Ready** - 24/7 uptime, auto-restart, health checks
3. **Maintainable** - Clear separation of concerns, documented code
4. **Developer Friendly** - Easy to test locally, deploy globally
5. **Secure** - Password hashing, JWT auth, CORS, environment variables

The infrastructure is set up for:
-  Immediate testing with mobile app
-  Easy feature additions
-  Zero-downtime deployments
-  Scaling as user base grows

---

## Next Steps

### For New Team Members:

1. Read this document
2. Follow "Getting Started" section
3. Run local backend: `npm run dev`
4. Test with Swagger UI: http://localhost:3000/api/docs
5. Ask questions in Discord/Slack

### For Future Development:

1. Add new features in separate branches
2. Test locally first
3. Deploy to staging (if available)
4. Deploy to production
5. Monitor logs for issues

### For Production Issues:

1. Check Railway logs: `railway logs --follow`
2. Verify environment variables are set
3. Check database status
4. Review error messages carefully
5. Contact team/support if stuck

---

## Useful Commands Reference

```bash
# Development
npm run dev              # Start with auto-reload
npm run build           # Compile TypeScript
npm start               # Start production build

# Database
npx prisma studio      # Visual database explorer
npx prisma generate    # Regenerate types
npx prisma migrate dev --name "description"  # Create migration
npx prisma migrate deploy  # Apply migrations

# Testing
npx ts-node verify-schema.ts  # Verify DB schema

# Railway
railway login           # Authenticate
railway link           # Connect to project
railway up             # Deploy
railway logs           # View logs
railway variables      # View environment variables
railway status         # Check deployment status
railway domain         # Generate public URL
```

---

**Questions?** Check the code comments, Railway docs, or Prisma documentation!

Happy deploying! 

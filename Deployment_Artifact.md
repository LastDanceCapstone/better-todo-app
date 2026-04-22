# Deployment Guide — Prioritize: Stay Ahead, Stay Organized
**Team:** Last Dance  
**Document Version:** 1.0  
**Date:** April 19, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Assumptions](#2-assumptions)
3. [Dependencies](#3-dependencies)
4. [Constraints](#4-constraints)
5. [Description of Deployment Artifacts](#5-description-of-deployment-artifacts)
6. [Data Creation](#6-data-creation)
7. [Admin Credentials](#7-admin-credentials)
8. [Deployment Process](#8-deployment-process)
9. [Appendix A: Required Environment Variables](#appendix-a-required-environment-variables)
10. [Appendix B: Packaging Checklist](#appendix-b-packaging-checklist)
11. [Recommended ZIP Contents](#recommended-zip-contents)

---

## 1. Overview

### Purpose of This Document

This deployment guide provides complete, step-by-step instructions for installing, configuring, and deploying the **Prioritize** application in a production-like environment. It is intended for developers, DevOps engineers, or evaluators who need to replicate the system from source code or from existing deployment artifacts.

### Purpose of the Project

**Prioritize** is a mobile productivity application designed to help users capture, organize, and track personal tasks. It leverages AI-assisted task parsing and voice transcription so that users can quickly add tasks using natural language, and it provides scheduling, subtask management, analytics, focus mode, calendar synchronization, and push notification capabilities.

### What the Application Does

- **Task Management:** Users can create, edit, prioritize, and complete tasks with due dates, subtasks, and status tracking.
- **AI Task Parsing:** Users describe tasks in natural language or via voice; the backend uses OpenAI GPT-4o-mini and Whisper to parse structured task data.
- **Google Sign-In & Email Auth:** Users may register via email/password or sign in with their Google account.
- **Push Notifications:** Scheduled cron-based morning and evening summaries, plus due-soon and overdue alerts delivered through Expo's push infrastructure.
- **Analytics & Focus Mode:** Users can record focus sessions and view productivity trends and heatmaps.
- **Calendar Sync:** Tasks with due dates can be synced to the device's native Apple Calendar (iOS).
- **Email Verification & Password Reset:** Users receive transactional emails via the Resend platform.
- **Avatar Uploads:** User profile avatars can optionally be stored on AWS S3.
- **Error Monitoring:** Both backend and mobile are instrumented with Sentry for runtime error tracking.

### Major System Components

| Component | Technology | Hosted On |
|---|---|---|
| Mobile App | React Native 0.81.5, Expo SDK 54, TypeScript | User device (iOS / Android) |
| Backend API | Node.js 18, Express 5, TypeScript | Railway |
| Database | PostgreSQL (via Prisma ORM) | Railway (managed PostgreSQL) |
| AI / NLP | OpenAI GPT-4o-mini, Whisper-1 | OpenAI API |
| Authentication | JWT, Google OAuth 2.0 | Self-hosted (backend), Google Cloud |
| Email | Resend | Resend API |
| Push Notifications | Expo Notifications | Expo Push Service |
| File Storage | AWS S3 (optional) | Amazon Web Services |
| Error Monitoring | Sentry | Sentry.io |
| Mobile CI/CD | EAS (Expo Application Services) | Expo / EAS |
| Calendar Sync | expo-calendar | On-device (iOS) |

---

## 2. Assumptions

The following assumptions apply when deploying this application:

### Developer Machine

- macOS is the primary development environment (iOS builds require macOS with Xcode).
- The developer has administrator-level access on their machine.
- Internet access is available throughout all installation and build steps.
- Git is installed and the repository has been cloned.

### Runtime Environment

- **Node.js:** Version 18.x (as specified in `backend/nixpacks.toml` via `nodejs-18_x`).
- **npm:** Version 8 or higher.
- **TypeScript:** 5.9.x (installed per project, no global requirement).

### Hosting Accounts and External Services

- A **Railway** account is available and the Railway CLI is installed for backend deployment.
- A **PostgreSQL** database is provisioned on Railway (or another compatible managed PostgreSQL host).
- An **OpenAI** API account with access to `gpt-4o-mini` and `whisper-1` models.
- A **Resend** account with a verified sending domain/address configured.
- A **Google Cloud Console** project with OAuth 2.0 credentials (Web Client ID, iOS Client ID).
- An **Expo** account with access to EAS (Expo Application Services) for mobile builds.
- *(Optional)* An **AWS** account with an S3 bucket configured for avatar storage. If not required, `REQUIRE_S3_UPLOADS=false` disables S3 at runtime.
- *(Optional)* A **Sentry** account and DSNs configured for error monitoring.

### Apple / iOS

- An Apple Developer account is required to build and sign iOS apps.
- For a development build: Xcode 15+ and CocoaPods 1.15+ must be installed.
- For EAS cloud builds: No local Xcode is required; credentials are managed by EAS.

### Database

- A PostgreSQL database instance is running and accessible via `DATABASE_URL`.
- The database user has permissions to create tables, indexes, and enums.
- The database is empty on first deployment; migrations create all schema objects.

### Mobile App

- End users must be running iOS 16+ for full feature support.
- Android support exists in the codebase but production builds and Google Play deployment are **not fully configured** in this repository (to be completed by team).
- The app runs as an Expo development build (`developmentClient: true`) for internal testing; a production build is configured via the `production` EAS profile.

---

## 3. Dependencies

### 3.1 Backend Dependencies

**Runtime**

| Package | Version | Purpose |
|---|---|---|
| Node.js | 18.x | JavaScript runtime |
| npm | 8+ | Package manager |
| TypeScript | ^5.9.3 | Static typing / transpilation |
| Express | ^5.1.0 | HTTP server framework |
| @prisma/client | ^5.20.0 | Database ORM client |
| bcrypt | ^6.0.0 | Password hashing |
| bcryptjs | ^3.0.3 | Password hashing (JS fallback) |
| jsonwebtoken | ^9.0.2 | JWT issuance and verification |
| google-auth-library | ^10.6.2 | Google ID token verification |
| resend | ^6.9.2 | Transactional email delivery |
| cors | ^2.8.5 | Cross-origin resource sharing |
| helmet | ^8.1.0 | HTTP security headers |
| dotenv | ^17.2.3 | Environment variable loading |
| express-rate-limit | ^8.3.2 | API rate limiting |
| zod | ^4.3.6 | Runtime schema validation |
| multer | ^2.1.1 | Multipart file uploads |
| node-cron | ^4.2.1 | Scheduled notification jobs |
| @aws-sdk/client-s3 | ^3.1029.0 | AWS S3 file storage |
| @aws-sdk/s3-request-presigner | ^3.1029.0 | S3 presigned URL generation |
| @sentry/node | ^10.48.0 | Backend error monitoring |
| swagger-jsdoc | ^6.2.8 | OpenAPI spec generation |
| swagger-ui-express | ^5.0.1 | Swagger UI serving |
| undici | ^5.29.0 | HTTP client (Node.js native) |

**Build / Dev**

| Package | Version | Purpose |
|---|---|---|
| prisma | ^5.20.0 | Prisma CLI (migrations, generate) |
| nodemon | ^3.1.10 | Dev server auto-reload |
| ts-node | ^10.9.2 | TypeScript execution |
| ts-node-dev | ^2.0.0 | Fast TypeScript dev runner |
| jest | ^29.7.0 | Testing framework |
| ts-jest | ^29.4.9 | Jest TypeScript transformer |
| supertest | ^7.2.2 | HTTP integration testing |

### 3.2 Mobile Dependencies

**Core**

| Package | Version | Purpose |
|---|---|---|
| react | 19.1.0 | UI library |
| react-native | 0.81.5 | Native mobile framework |
| expo | ~54.0.33 | Expo SDK |
| TypeScript | ~5.9.2 | Static typing |

**Navigation**

| Package | Version | Purpose |
|---|---|---|
| @react-navigation/native | ^7.1.19 | Navigation container |
| @react-navigation/native-stack | ^7.6.2 | Stack navigator |
| @react-navigation/bottom-tabs | ^7.7.3 | Tab navigator |
| react-native-screens | ~4.16.0 | Native screen containers |
| react-native-safe-area-context | ~5.6.0 | Safe area insets |

**Expo Modules**

| Package | Version | Purpose |
|---|---|---|
| expo-dev-client | ~6.0.20 | Development build client |
| expo-notifications | ~0.32.16 | Push notification handling |
| expo-calendar | ~15.0.8 | Native calendar access |
| expo-av | ~16.0.8 | Audio recording / playback |
| expo-image-picker | ~17.0.8 | Photo library / camera access |
| expo-constants | ~18.0.13 | App constants and configuration |
| expo-linking | ~8.0.11 | Deep linking |
| expo-web-browser | ~15.0.10 | In-app browser |
| expo-auth-session | ~7.0.10 | Auth session helpers |
| expo-crypto | ~15.0.8 | Cryptographic utilities |
| expo-font | ~14.0.11 | Custom fonts |
| expo-haptics | ~15.0.8 | Haptic feedback |
| expo-linear-gradient | ~15.0.8 | Gradient components |
| expo-secure-store | ~15.0.8 | Encrypted storage |
| expo-status-bar | ~3.0.8 | Status bar control |
| expo-application | ~7.0.8 | App version utilities |

**Third-Party**

| Package | Version | Purpose |
|---|---|---|
| @react-native-async-storage/async-storage | 2.2.0 | Persisted token and user storage |
| @react-native-google-signin/google-signin | ^16.1.2 | Native Google Sign-In |
| @react-native-community/datetimepicker | 8.4.4 | Native date/time picker |
| @sentry/react-native | ^8.7.0 | Mobile error monitoring |
| react-native-reanimated | ~4.1.1 | Gesture animations |
| react-native-gesture-handler | ~2.28.0 | Native gesture recognition |
| react-native-calendars | ^1.1314.0 | Calendar UI component |
| react-native-modal-datetime-picker | ^18.0.0 | Modal date/time picker |
| react-native-svg | 15.12.1 | SVG rendering |
| react-native-vector-icons | ^10.3.0 | Icon library |
| @expo/vector-icons | ^15.0.3 | Expo-wrapped icons |

### 3.3 Database

| Component | Details |
|---|---|
| Engine | PostgreSQL (version managed by Railway) |
| ORM | Prisma 5.20.0 |
| Connection | Via `DATABASE_URL` (PostgreSQL connection string) |
| Schema | Defined in `backend/prisma/schema.prisma` |
| Migrations | Managed via `prisma migrate deploy` |

### 3.4 Deployment Tooling

| Tool | Version | Purpose |
|---|---|---|
| Railway CLI | Latest | Backend deployment |
| EAS CLI | >= 18.4.0 (per eas.json) | Mobile build and submission |
| Nixpacks | Railway-managed | Backend build system |
| CocoaPods | 1.15+ | iOS native dependency management |
| Xcode | 15+ | iOS device/simulator builds (local) |

### 3.5 Third-Party Services

| Service | Account Required | Purpose |
|---|---|---|
| Railway | Yes | Backend API + PostgreSQL hosting |
| OpenAI | Yes | AI task parsing and audio transcription |
| Google Cloud Console | Yes | OAuth 2.0 credentials |
| Resend | Yes | Transactional email (password reset, verification) |
| Expo / EAS | Yes | Mobile builds and push notification delivery |
| Apple Developer | Yes (iOS builds) | App signing, distribution |
| AWS S3 | Optional | Avatar image file storage |
| Sentry.io | Optional | Error monitoring |

---

## 4. Constraints

### Platform Requirements

- **iOS (primary):** The Expo development build requires iOS 16 or later. Production builds target the App Store.
- **Android:** Android support code is present in the repository but an Android production build profile and Google Play submission are **not fully configured**. Android development builds are possible with `eas build --profile development --platform android`.
- **Backend:** Node.js 18.x required. Runs on Linux (Railway container, via Nixpacks).
- **macOS:** Required on the developer machine for local iOS builds via Xcode and CocoaPods.

### Expo / EAS Constraints

- The app **cannot run in Expo Go** because it includes native modules (`@react-native-google-signin/google-signin`, `expo-notifications`, `@sentry/react-native`) that require a custom native binary.
- All installations must use a **development build** (`expo-dev-client`) or a **production/preview EAS build**.
- EAS CLI version must be >= 18.4.0 as specified in `mobile/eas.json`.
- The EAS project ID is `4d7852b5-0757-4fe8-ab54-d9baf872ea73`.
- Mobile app version is managed remotely via EAS (`appVersionSource: remote`).

### Apple / Google OAuth Constraints

- The iOS bundle identifier is `com.london.prioritize`.
- The iOS Google OAuth client ID requires `com.googleusercontent.apps.857743457833-t9fdc2a1gdgluk0gapo1fu839ejfge4h` as the URL scheme, which is already configured in `app.json`.
- Google Sign-In requires that the bundle identifier of the iOS app matches the registered OAuth credential in Google Cloud Console.
- `GOOGLE_CLIENT_ID` on the backend must match the web client ID registered in Google Cloud Console so the backend can verify Google-issued ID tokens.

### Environment Variable Requirements

- **Backend:** The app will not start without `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `OPENAI_API_KEY`, `RESEND_API_KEY`, and `MAIL_FROM`.
- **Mobile:** The app will not start without `EXPO_PUBLIC_API_URL`. In production builds, the URL must use HTTPS and must not point to localhost or a LAN IP.
- **Mobile (production):** `EXPO_PUBLIC_API_URL` is validated against `EXPO_PUBLIC_PRODUCTION_API_URL` at build time.

### Network and Connectivity

- The backend requires internet access to reach the OpenAI API, Resend API, Google OAuth endpoints, and (if enabled) AWS S3.
- The mobile app requires internet access to reach the backend API and Expo Push Service.
- Push notifications via Expo are delivered through Expo's infrastructure and require the device to have a valid Expo push token registered via `POST /api/notifications/push-devices`.

### Security Constraints

- JWT tokens expire after 24 hours.
- Password reset codes expire after 10 minutes.
- Email verification codes expire after 15 minutes.
- Forgot-password endpoint is rate-limited to 5 requests per IP per 15 minutes.
- The backend enforces HTTPS in production via Railway's reverse proxy.
- The `helmet` middleware is applied globally on the backend.
- AWS S3 avatar uploads are controlled via presigned URLs; `REQUIRE_S3_UPLOADS=false` allows avatar functionality to be disabled at runtime.

### Rate Limits / API Quotas

- **OpenAI API:** Subject to the account's RPM and token limits. The default model is `gpt-4o-mini`.
- **Resend:** Subject to Resend account sending limits.
- **Expo Push Notifications:** Subject to Expo's push delivery rate limits.
- **Google OAuth:** Standard Google API quotas apply.

---

## 5. Description of Deployment Artifacts

### System Deployment Diagram

```
User Device (iOS)
    │
    ├─► Prioritize Mobile App (React Native / Expo SDK 54)
    │       │
    │       ├─► EXPO_PUBLIC_API_URL ──► Backend REST API (Node.js / Express 5)
    │       │                               │
    │       │                               ├─► PostgreSQL (Railway)
    │       │                               ├─► OpenAI API (task parsing / transcription)
    │       │                               ├─► Google Auth Library (token verification)
    │       │                               ├─► Resend (email delivery)
    │       │                               └─► AWS S3 (optional avatar storage)
    │       │
    │       ├─► Google Sign-In SDK ──► Google OAuth 2.0
    │       ├─► expo-notifications ──► Expo Push Service ──► APNs (iOS)
    │       ├─► expo-calendar ──────► Apple Calendar (on-device)
    │       └─► Sentry SDK ─────────► Sentry.io
    │
    └─► Sentry (backend) ──► Sentry.io
```

### 5.1 Source Code Folders

| Path | Contents |
|---|---|
| `backend/src/` | All backend TypeScript source files |
| `backend/prisma/` | Prisma schema and all migration SQL files |
| `mobile/src/` | All mobile TypeScript source files |
| `mobile/assets/` | App icons, splash screen images |
| `mobile/ios/` | Xcode iOS project (CocoaPods and generated files) |

### 5.2 Configuration Files

| File | Purpose |
|---|---|
| `backend/.env.example` | Backend environment variable template |
| `backend/prisma/schema.prisma` | Database schema definition |
| `backend/nixpacks.toml` | Railway/Nixpacks build instructions |
| `backend/railway.json` | Railway deployment configuration |
| `backend/tsconfig.json` | Backend TypeScript compiler settings |
| `mobile/.env.example` | Mobile environment variable template |
| `mobile/app.json` | Expo app configuration (bundle ID, plugins, scheme) |
| `mobile/app.config.js` | Dynamic Expo config (if present, overrides app.json) |
| `mobile/eas.json` | EAS build profiles (development, preview, production) |
| `mobile/tsconfig.json` | Mobile TypeScript compiler settings |
| `mobile/babel.config.js` | Babel transformation settings |

### 5.3 Build Artifacts

#### Backend

After running `npm run build` in the `backend/` directory:

| Artifact | Location | Description |
|---|---|---|
| Compiled JavaScript | `backend/dist/` | All TypeScript compiled to CommonJS JS |
| Entry point | `backend/dist/index.js` | Production server entry |
| Prisma client | `backend/node_modules/.prisma/client/` | Auto-generated database client |

The `backend/dist/` folder is the complete production backend artifact. It is run with `node dist/index.js`.

#### Mobile

EAS produces `.ipa` (iOS) or `.apk`/`.aab` (Android) files on the EAS cloud. For a local development build:

| Artifact | Location | Description |
|---|---|---|
| iOS development app | `mobile/ios/build/` or EAS | `.ipa` or installed `.app` on device/simulator |
| CocoaPods lock | `mobile/ios/Podfile.lock` | Pod dependency lock file |
| Generated autolinking | `mobile/ios/build/generated/` | Auto-generated native glue code |

**Note:** Production `.ipa` files are built and distributed through EAS and are not stored in the repository.

### 5.4 Deployment-Related Files

| File | Purpose |
|---|---|
| `backend/nixpacks.toml` | Defines Railway build phases |
| `backend/railway.json` | Defines Railway deploy start command and health check |
| `mobile/eas.json` | Defines EAS build profiles and environments |

### 5.5 Files That Should NOT Be Included in Deployment Artifacts

- `.env` files containing real secrets
- `node_modules/` directories
- `backend/dist/` (built from source by the CI pipeline)
- `mobile/ios/Pods/` (re-generated by `pod install`)
- `mobile/ios/build/` (re-generated at build time)
- `.git/` directory
- `*.log` files, `tmp/` and `.tmp/` directories

---

## 6. Data Creation

### Initial Database State

The database starts **empty** (no pre-seeded users, tasks, or records). All schema objects (tables, indexes, enums, constraints) are created by running Prisma migrations.

**There is no seed script in this repository.** The first user account is created through the normal registration flow (`POST /api/register`) or Google Sign-In (`POST /api/google-auth`).

### Database Creation Steps

1. Provision a PostgreSQL database (Railway, Supabase, or any compatible host).
2. Copy the connection string into the `DATABASE_URL` environment variable on the backend.
3. On first deploy (or locally), run:

```bash
cd backend
npx prisma migrate deploy
```

This applies all 11 migrations in chronological order and creates the complete schema.

### Migration History

All migrations are located under `backend/prisma/migrations/` and are applied in this order:

| Migration | Description |
|---|---|
| `20251105060459_init` | Initial schema: User, Task, Subtask tables |
| `20260128214710_update_schema` | Schema restructure, new enums, renamed tables |
| `20260223000000_add_password_reset_fields` | Password reset token and expiry fields |
| `20260321000000_add_google_auth_provider` | `authProvider` enum, `googleId` field, optional password |
| `20260326000000_add_notifications` | `notifications` table with `NotificationType` enum |
| `20260410000000_add_notification_settings_and_links` | `notification_settings` table; `taskId` and `dedupeKey` on notifications |
| `20260411000000_add_email_verification_and_focus_sessions` | Email verification fields, `focus_sessions` table |
| `20260412000000_add_push_devices_and_avatars` | `avatarUrl` on users, `push_devices` table with `DevicePlatform` enum |
| `20260413000000_add_is_verified_backfill` | `isVerified` field on users, backfill to true |
| `20260413010000_add_push_enabled_to_notification_settings` | `pushEnabled` field on notification_settings |
| `20260416090000_add_user_timezone` | `timezone` field on users (default: `UTC`) |

### Production Migration Command (Auto-Applied at Startup)

The `npm start` script automatically runs migrations before starting the server:

```bash
npx prisma migrate deploy && node dist/index.js
```

This means no manual migration step is needed on Railway after the initial setup.

---

## 7. Admin Credentials

Admin credentials are **not stored in the repository** and must be provisioned securely through environment variables or manual setup.

### Credential Model

This application uses a single-tier user model. There are no database-level admin roles or super-user accounts. All users have equivalent access to their own data, enforced by JWT authentication.

### First Account Setup

After deployment, the first account is created by:

1. Navigating to the login screen and selecting "Create Account," **or**
2. Calling `POST /api/register` with a JSON body:

```json
{
  "firstName": "Admin",
  "lastName": "User",
  "email": "admin@example.com",
  "password": "your-secure-password"
}
```

### JWT Secret

The `JWT_SECRET` environment variable controls the signing key for all authentication tokens. This value:

- Must be a cryptographically strong random string (minimum 64 characters recommended).
- Must **not** be committed to version control.
- Must be set identically across all backend instances if horizontal scaling is used.

### No Hardcoded Credentials

No credentials, secrets, or API keys are committed to the repository. All sensitive values are referenced by environment variable name only. Refer to [Appendix A](#appendix-a-required-environment-variables) for the complete variable list.

---

## 8. Deployment Process

### Phase 1: Prerequisites

Install the following tools before proceeding:

```bash
# Verify Node.js 18
node --version  # Expected: v18.x.x

# Verify npm
npm --version  # Expected: 8+

# Install Railway CLI
npm install -g @railway/cli

# Install EAS CLI (mobile builds)
npm install -g eas-cli

# Verify EAS CLI
eas --version  # Expected: >= 18.4.0

# macOS only: Install CocoaPods for local iOS builds
sudo gem install cocoapods
pod --version  # Expected: 1.15+
```

---

### Phase 2: Repository Setup

```bash
# Clone the repository
git clone https://github.com/LastDanceCapstone/better-todo-app.git
cd better-todo-app
```

---

### Phase 3: Backend — Environment Variable Configuration

```bash
cd backend

# Copy the example environment file
cp .env.example .env
```

Open `backend/.env` and fill in all required values:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=<generate a 64+ character random string>
GOOGLE_CLIENT_ID=<your Google Web OAuth Client ID>
OPENAI_API_KEY=<your OpenAI API key>
OPENAI_MODEL=gpt-4o-mini
WHISPER_MODEL=whisper-1
RESEND_API_KEY=<your Resend API key>
MAIL_FROM=<your verified Resend sender address>
NODE_ENV=production
REQUIRE_S3_UPLOADS=false
CORS_ORIGINS=<comma-separated list of allowed origins, e.g. your Railway domain>
MORNING_NOTIFICATION_CRON=0 8 * * *
EVENING_NOTIFICATION_CRON=0 20 * * *
```

Optional (fill only if using the feature):
```
SENTRY_DSN=<backend Sentry DSN>
SENTRY_ENVIRONMENT=production
AWS_REGION=<e.g. us-east-1>
AWS_ACCESS_KEY_ID=<AWS access key>
AWS_SECRET_ACCESS_KEY=<AWS secret key>
S3_BUCKET_NAME=<your S3 bucket name>
REQUIRE_S3_UPLOADS=true
FRONTEND_URL=<your deployed app URL>
MOBILE_DEV_URL=<development machine LAN URL for local testing>
PRODUCTION_APP_URL=<your Railway backend URL>
```

---

### Phase 4: Backend — Dependency Installation and Build

```bash
cd backend

# Install all dependencies (including dev deps for build)
npm ci --include=dev

# Generate the Prisma client
npx prisma generate

# Compile TypeScript to dist/
npm run build
```

The `dist/` directory now contains the production-ready backend binary.

---

### Phase 5: Database Setup (Local or First Deployment)

```bash
cd backend

# Run all pending migrations against DATABASE_URL
npx prisma migrate deploy
```

All 11 migrations will be applied and the complete schema will be created. No further manual SQL is required.

---

### Phase 6: Backend — Local Development Start

```bash
cd backend

# Start with auto-reload (development)
npm run dev
```

The backend will start on the port specified in the `PORT` environment variable (defaults to 3000).

- Health check: `http://localhost:3000/health`
- Swagger UI: `http://localhost:3000/api/docs`

---

### Phase 7: Backend — Production Deployment (Railway)

```bash
# Authenticate with Railway
railway login

# Link to your Railway project (or create a new one)
railway init

# Set environment variables on Railway
# (Do this via the Railway dashboard or CLI for each variable in Phase 3)
railway variables set DATABASE_URL="..."
railway variables set JWT_SECRET="..."
railway variables set OPENAI_API_KEY="..."
# ... (set all required variables)

# Deploy to Railway
railway up
```

Railway will execute the following build and start sequence automatically (as defined in `backend/railway.json` and `backend/nixpacks.toml`):

**Build:**
```
npm install && npx prisma generate && npm run build
```

**Start:**
```
npx prisma migrate deploy && node dist/index.js
```

Health check path: `GET /health` (timeout: 100 seconds).

Verify the deployment:
```bash
curl https://YOUR_RAILWAY_DOMAIN/health
```

Expected response: `{ "status": "ok", ... }`

---

### Phase 8: Mobile — Environment Variable Configuration

```bash
cd ../mobile

# Copy the example environment file
cp .env.example .env
```

Open `mobile/.env` and fill in all required values:

```
EXPO_PUBLIC_API_URL=https://YOUR_RAILWAY_BACKEND_DOMAIN
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_PRODUCTION_API_URL=https://YOUR_RAILWAY_BACKEND_DOMAIN
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<your Google iOS OAuth client ID>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<your Google Web OAuth client ID>
```

Optional:
```
EXPO_PUBLIC_SENTRY_DSN=<your Sentry DSN for mobile>
```

---

### Phase 9: Mobile — Dependency Installation (iOS)

```bash
cd mobile

# Install JavaScript dependencies
npm install

# Install iOS CocoaPods (for local builds only)
npx pod-install
```

The `npx pod-install` step will install all native iOS pods including `RNGoogleSignin`, `GoogleSignIn`, and all other required native modules.

---

### Phase 10: Mobile — Local iOS Development Build

Use this workflow for local testing on a simulator or a device connected via USB:

```bash
cd mobile

# Build and install development app on iOS simulator
npx expo run:ios
```

This compiles the Xcode project and installs the development build on the default simulator. Once installed, use:

```bash
# Start Metro bundler (connect to already-installed development build)
npx expo start --dev-client
```

**Important:** The app must be opened using the installed development build, not Expo Go. Expo Go does not include the required native modules (`RNGoogleSignin`, `expo-notifications`, `@sentry/react-native`).

---

### Phase 11: Mobile — EAS Cloud Build (Production-Like / Distribution)

Use EAS to build signed `.ipa` files without a local Mac or for distribution.

```bash
# Authenticate with Expo
eas login

# Development build (internal distribution, includes dev client)
eas build --profile development --platform ios

# Preview build (internal distribution, no dev client)
eas build --profile preview --platform ios

# Production build (App Store distribution)
eas build --profile production --platform ios
```

After a production build completes, submit to the App Store:

```bash
eas submit --platform ios
```

---

### Phase 12: Verification

After deployment, verify all system components:

```bash
# Backend health check
curl https://YOUR_RAILWAY_DOMAIN/health

# API documentation (browser)
open https://YOUR_RAILWAY_DOMAIN/api/docs

# Test user registration (replace with your domain)
curl -X POST https://YOUR_RAILWAY_DOMAIN/api/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","password":"password123"}'

# Test login
curl -X POST https://YOUR_RAILWAY_DOMAIN/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

On the mobile side:
1. Open the installed development or production build.
2. Register or log in using email/password or Google Sign-In.
3. Create a test task using voice input or natural language.
4. Verify the task appears in the home screen with AI-parsed fields.
5. Enable push notifications when prompted and verify delivery.

---

## Appendix A: Required Environment Variables

### Backend Environment Variables

| Variable Name | Required | Used By | Purpose | Example Placeholder |
|---|---|---|---|---|
| `DATABASE_URL` | **Required** | Backend | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |
| `JWT_SECRET` | **Required** | Backend | JWT signing key (min. 64 chars recommended) | `your-64-character-random-secret-key` |
| `GOOGLE_CLIENT_ID` | **Required** | Backend | Google OAuth Web Client ID for ID token verification | `123456789-abc.apps.googleusercontent.com` |
| `OPENAI_API_KEY` | **Required** | Backend | OpenAI API key for task parsing and transcription | `sk-...` |
| `OPENAI_MODEL` | Optional | Backend | GPT model name (default: `gpt-4o-mini`) | `gpt-4o-mini` |
| `WHISPER_MODEL` | Optional | Backend | Whisper model name (default: `whisper-1`) | `whisper-1` |
| `RESEND_API_KEY` | **Required** | Backend | Resend API key for sending emails | `re_...` |
| `MAIL_FROM` | **Required** | Backend | Verified sender email address | `noreply@yourdomain.com` |
| `NODE_ENV` | Optional | Backend | Runtime environment label | `production` |
| `PORT` | Optional | Backend | HTTP listen port (default: 3000) | `3000` |
| `CORS_ORIGINS` | Optional | Backend | Comma-separated allowed CORS origins | `https://your-app.railway.app` |
| `SENTRY_DSN` | Optional | Backend | Sentry DSN for error tracking | `https://key@sentry.io/project` |
| `SENTRY_ENVIRONMENT` | Optional | Backend | Sentry environment label | `production` |
| `REQUIRE_S3_UPLOADS` | Optional | Backend | Enable S3 avatar uploads (`true`/`false`) | `false` |
| `AWS_REGION` | Optional | Backend | AWS region for S3 | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | Optional | Backend | AWS access key (if S3 enabled) | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Optional | Backend | AWS secret key (if S3 enabled) | `wJalrXUtnFEMI/...` |
| `S3_BUCKET_NAME` | Optional | Backend | S3 bucket name for avatars | `prioritize-avatars` |
| `FRONTEND_URL` | Optional | Backend | Allowed frontend origin URL | `https://your-app.railway.app` |
| `MOBILE_DEV_URL` | Optional | Backend | LAN URL for local mobile dev | `http://192.168.1.100:3000` |
| `PRODUCTION_APP_URL` | Optional | Backend | Production app URL for references | `https://your-app.railway.app` |
| `SWAGGER_SERVER_URL` | Optional | Backend | Override Swagger server URL | `https://your-backend.railway.app/api` |
| `MORNING_NOTIFICATION_CRON` | Optional | Backend | Cron schedule for morning notifications | `0 8 * * *` |
| `EVENING_NOTIFICATION_CRON` | Optional | Backend | Cron schedule for evening notifications | `0 20 * * *` |
| `DUE_SOON_NOTIFICATION_CRON` | Optional | Backend | Cron schedule for due-soon notifications | To be filled/verified by team |
| `OVERDUE_NOTIFICATION_CRON` | Optional | Backend | Cron schedule for overdue notifications | To be filled/verified by team |

### Mobile Environment Variables

| Variable Name | Required | Used By | Purpose | Example Placeholder |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | **Required** | Mobile | Base URL for the backend API | `https://your-backend.railway.app` |
| `EXPO_PUBLIC_APP_ENV` | Optional | Mobile | App environment label | `production` |
| `EXPO_PUBLIC_PRODUCTION_API_URL` | Optional | Mobile (prod build) | Production URL for validation in EAS production builds | `https://your-backend.railway.app` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | **Required** (iOS) | Mobile | Google OAuth iOS Client ID | `857743457833-xxxxxxxx.apps.googleusercontent.com` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | **Required** | Mobile | Google OAuth Web Client ID | `857743457833-xxxxxxxx.apps.googleusercontent.com` |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional | Mobile | Sentry DSN for mobile error tracking | `https://key@sentry.io/project` |

---

## Appendix B: Packaging Checklist

### Source Code ZIP

The source code ZIP should include:

- [ ] `backend/src/` — all TypeScript backend source files
- [ ] `backend/prisma/` — Prisma schema and all migration SQL files
- [ ] `backend/package.json` and `backend/package-lock.json`
- [ ] `backend/tsconfig.json`
- [ ] `backend/nixpacks.toml`
- [ ] `backend/railway.json`
- [ ] `backend/.env.example` (template only — no real secrets)
- [ ] `mobile/src/` — all TypeScript mobile source files
- [ ] `mobile/assets/` — app icon and splash images
- [ ] `mobile/ios/` — Xcode project files (excluding `ios/Pods/` and `ios/build/`)
- [ ] `mobile/package.json` and `mobile/package-lock.json`
- [ ] `mobile/app.json`
- [ ] `mobile/app.config.js` (if present)
- [ ] `mobile/eas.json`
- [ ] `mobile/babel.config.js`
- [ ] `mobile/tsconfig.json`
- [ ] `mobile/.env.example` (template only — no real secrets)
- [ ] `README.md` (root level)
- [ ] `Deployment_Guide_Prioritize_Last_Dance.md` (this document)

**Exclude from source ZIP:**
- [ ] ~~`backend/node_modules/`~~
- [ ] ~~`backend/dist/`~~
- [ ] ~~`mobile/node_modules/`~~
- [ ] ~~`mobile/ios/Pods/`~~
- [ ] ~~`mobile/ios/build/`~~
- [ ] ~~`backend/.env`~~ (real secrets)
- [ ] ~~`mobile/.env`~~ (real secrets)
- [ ] ~~`.git/`~~
- [ ] ~~`*.log` files~~

### Deployment Artifacts ZIP

The deployment artifacts ZIP should include:

- [ ] `backend/dist/` — compiled TypeScript output (generated by `npm run build`)
- [ ] `backend/package.json` — for production `npm ci --omit=dev` reference
- [ ] `backend/prisma/` — migrations and schema (required by `prisma migrate deploy`)
- [ ] `backend/nixpacks.toml` — Railway build configuration
- [ ] `backend/railway.json` — Railway deployment configuration
- [ ] `backend/.env.example` — as reference for required variables
- [ ] Mobile `.ipa` file — generated by EAS cloud build (not in repository; download from EAS dashboard)
- [ ] `Deployment_Guide_Prioritize_Last_Dance.md`

**Note:** The production mobile `.ipa` is built and stored on the EAS dashboard. It is not a file artifact within the repository. Download it from `https://expo.dev` under the project build history for EAS project ID `4d7852b5-0757-4fe8-ab54-d9baf872ea73`.

### Referenced External Libraries and Services

The following external libraries and services are referenced in this deployment document and must be accounted for:

| Dependency | Location | Documentation |
|---|---|---|
| Prisma ORM | backend | https://www.prisma.io/docs |
| OpenAI API | backend | https://platform.openai.com/docs |
| Google Auth Library | backend | https://www.npmjs.com/package/google-auth-library |
| Resend | backend | https://resend.com/docs |
| Railway | backend hosting | https://docs.railway.app |
| Expo EAS | mobile builds | https://docs.expo.dev/eas |
| @react-native-google-signin | mobile | https://react-native-google-signin.github.io/docs/install |
| expo-notifications | mobile | https://docs.expo.dev/versions/latest/sdk/notifications |
| Sentry | monitoring | https://docs.sentry.io |

---

## Recommended ZIP Contents

**Suggested document filename:** `Deployment_Guide_Prioritize_Last_Dance.md`

### Source Code ZIP

Suggested filename: `Prioritize_SourceCode_LastDance.zip`

```
Prioritize_SourceCode_LastDance/
├── Deployment_Guide_Prioritize_Last_Dance.md
├── README.md
├── backend/
│   ├── .env.example
│   ├── nixpacks.toml
│   ├── railway.json
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── index.ts
│       ├── app.ts
│       ├── swagger.ts
│       ├── config/
│       ├── jobs/
│       ├── llm/
│       ├── middleware/
│       ├── monitoring/
│       ├── routes/
│       ├── services/
│       └── utils/
└── mobile/
    ├── .env.example
    ├── app.json
    ├── app.config.js
    ├── eas.json
    ├── babel.config.js
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── App.tsx
    ├── index.ts
    ├── assets/
    ├── ios/              (exclude Pods/ and build/)
    └── src/
        ├── components/
        ├── config/
        ├── hooks/
        ├── monitoring/
        ├── screens/
        ├── services/
        ├── theme/
        └── utils/
```

### Deployment Artifacts ZIP

Suggested filename: `Prioritize_DeploymentArtifacts_LastDance.zip`

```
Prioritize_DeploymentArtifacts_LastDance/
├── Deployment_Guide_Prioritize_Last_Dance.md
├── backend/
│   ├── .env.example
│   ├── nixpacks.toml
│   ├── railway.json
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── dist/               ← compiled TypeScript output
│       ├── index.js
│       ├── app.js
│       ├── routes/
│       ├── services/
│       └── ...
└── mobile/
    └── [Prioritize_v1.1.1_production.ipa]   ← downloaded from EAS dashboard
        NOTE: Download from https://expo.dev
              Project ID: 4d7852b5-0757-4fe8-ab54-d9baf872ea73
```

---

*Document generated for capstone submission — Last Dance Team — April 2026*

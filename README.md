# Prioritize

Prioritize is a full-stack productivity app with a React Native mobile client and a Node.js API. It helps users plan work, execute focused sessions, and stay on schedule with smart reminders.

## App Overview

Prioritize supports:
- Task and subtask management
- AI-assisted task parsing from natural language
- Focus mode sessions
- Calendar sync for due tasks
- Push notifications and in-app notification center
- Productivity analytics dashboard
- Authentication with email/password and Google Sign-In

## Tech Stack

Mobile:
- React Native (Expo)
- TypeScript
- React Navigation

Backend:
- Node.js
- Express
- Prisma ORM
- PostgreSQL (production)

Integrations:
- OpenAI (task parsing and audio transcription)
- Google OAuth
- AWS S3 (avatar uploads)
- Resend (transactional email)

Deployment:
- Railway (backend + database)
- Expo EAS (mobile builds)

## Repository Structure

- `mobile/` Expo React Native app
- `backend/` Express API + Prisma schema/migrations

## Setup Instructions

### 1) Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Run migrations and start dev server:

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Backend runs on `http://localhost:3000` by default.

### 2) Mobile Setup

```bash
cd mobile
npm install
cp .env.example .env
```

Start Expo:

```bash
npx expo start --dev-client --clear
```

Use a development build on device/simulator for push notifications and native integrations.

## Environment Variables

### Backend (`backend/.env`)

Required:
- `NODE_ENV`: Runtime environment (`development`, `production`, `test`)
- `PORT`: API port
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `GOOGLE_CLIENT_ID`: OAuth client ID for Google token verification
- `OPENAI_API_KEY`: OpenAI API key
- `RESEND_API_KEY`: Resend API key
- `MAIL_FROM`: Sender address for transactional email

Avatar uploads:
- `AWS_REGION`: AWS region
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `S3_BUCKET_NAME`: S3 bucket for avatar objects

Optional backend config:
- `OPENAI_MODEL`: LLM model for parsing
- `WHISPER_MODEL`: Model for audio transcription
- `SWAGGER_SERVER_URL`: Override Swagger server URL
- `RAILWAY_PUBLIC_DOMAIN`: Railway domain for URL generation
- `RAILWAY_STATIC_URL`: Railway static URL fallback
- `FRONTEND_URL`: Allowed browser origin
- `MOBILE_DEV_URL`: Allowed mobile/web dev origin
- `PRODUCTION_APP_URL`: Allowed production app origin
- `CORS_ORIGINS`: Comma-separated allow-list for browser origins
- `MORNING_NOTIFICATION_CRON`: Morning schedule cron
- `EVENING_NOTIFICATION_CRON`: Evening schedule cron
- `DUE_SOON_NOTIFICATION_CRON`: Due soon schedule cron
- `OVERDUE_NOTIFICATION_CRON`: Overdue schedule cron

### Mobile (`mobile/.env`)

Required:
- `EXPO_PUBLIC_API_URL`: Base URL for backend API (for example `https://<railway-domain>`)

Optional:
- `EXPO_PUBLIC_APP_ENV`: App environment label
- `EXPO_PUBLIC_PRODUCTION_API_URL`: Production API URL validation target for EAS production builds
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`: iOS Google OAuth client ID
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: Web Google OAuth client ID

## API and Swagger

Swagger UI:
- `GET /api/docs`

OpenAPI JSON:
- `GET /api/docs.json`

Health checks:
- `GET /api/health`
- `GET /health`

## Deployment Notes

Backend:
- Railway deploy command: `railway up`
- Start command runs migrations before boot (`prisma migrate deploy`)

Mobile:
- EAS development build: `eas build --profile development --platform ios`
- EAS production profile validates that `EXPO_PUBLIC_API_URL` is HTTPS and matches `EXPO_PUBLIC_PRODUCTION_API_URL`

## Testing

Backend tests:

```bash
cd backend
npm test -- --runInBand
```

Mobile tests:

```bash
cd mobile
npm test -- --runInBand
```

## Reproducible Generated Outputs

This repository keeps source files only. Generated artifacts (for example backend `dist/`) are intentionally not committed.

To regenerate backend runtime output from source:

```bash
cd backend
npm install
npm run build
```

This rebuilds `dist/` from TypeScript sources and Prisma client generation.

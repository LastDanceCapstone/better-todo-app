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
5. [Development Workflow](#development-workflow)
6. [Deployment Process](#deployment-process)
7. [Troubleshooting](#troubleshooting)
8. [Key Decisions](#key-decisions)

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
```

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
   npx expo start
   ```
   Scan QR code with Expo Go

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

# Capstone Project Workspace

This repository will serve as the general workspace for all changes, updates, and creations for the capstone project

----------

# Team Information
- **Team Name:** The Last Dance
- **Members:**
  - London Haith
  - Johnathan Dorsey
  - Samwel Makyao
  - Deevya Patel
  - Ryan StClair
 - **Overseeing Professor:** David Keathly

----------
 
# Project Links
- **Kanban Board:** https://trello.com/b/CSWlLk7f/capstone-kanban
- **Team Zoom:** https://us05web.zoom.us/j/87439424208?pwd=IuVsDdhyVNlJAh7mNVkwqRSrUSQjti.1
  -   Meeting ID: 874 3942 4208
  -   Passcode: 7epwSw
- **GitHub Repo:** https://github.com/LastDanceCapstone/better-todo-app

----------

# Prioritize – Todo App

A modern todo application with React Native mobile frontend and Node.js backend with Prisma ORM.



### Prerequisites / Installs
- **Node.js**
- **npm** 
- **Expo CLI** - Install globally: `npm install -g @expo/cli`
- **Expo Go app** on your mobile device

### Mobile Setup

1. **Navigate to mobile directory:**
   ```bash
   cd mobile
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start Expo development server:**
   ```bash
   # If your mobile device and computer are on the same WiFi network:
   npx expo start
   
   # If they're on different networks or you're having connection issues:
   npx expo start --tunnel
   ```

4. **Run on your device:**
   - Open **Expo Go** app on your phone
   - Scan the QR code displayed in your terminal
   - The app should load and display the Login screen

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Copy the `.env` file (already exists)
   - Update `DATABASE_URL` if needed (currently set to SQLite)

4. **Set up database:**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Push schema to database (creates tables)
   npx prisma db push
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   Server will start at: `http://localhost:3000`

6. **Test backend health:**
   - Open browser to: `http://localhost:3000/api/health`
   - Should see: `{"status":"OK","message":"Server is running"}`

### Database Management (Prisma Studio)

**View and manage your database:**
```bash
cd backend
npx prisma studio
```
- Opens Prisma Studio at: `http://localhost:5555`
- Provides a visual interface to view/edit database records

----------

## Running the Complete Application


**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Mobile:**
```bash
cd mobile
npx expo start
```

**Terminal 3 - Database Studio:**
```bash
cd backend
npx prisma studio
```


----------

## 📱 Mobile App Connection Setup

To connect your mobile app to the backend server:

1. **Find your computer's IP address:**
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig`
   - Look for IPv4 address (e.g., `192.168.1.150`)

2. **Update mobile app configuration:**
   - Edit `mobile/src/screens/LoginScreen.tsx`
   - Replace `localhost` with your IP address in the fetch URLs
   - Example: `http://192.168.1.150:3000/api/login`

----------

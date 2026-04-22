# Final Production Build Validation

Use this checklist after code/config/security updates and before App Store submission.

## Prerequisites

Set production environment variables for the mobile app:

- EXPO_PUBLIC_API_URL
- EXPO_PUBLIC_PRODUCTION_API_URL
- EXPO_PUBLIC_APP_ENV

Recommended values:

- EXPO_PUBLIC_API_URL: your production backend HTTPS URL
- EXPO_PUBLIC_PRODUCTION_API_URL: same URL as EXPO_PUBLIC_API_URL
- EXPO_PUBLIC_APP_ENV: production

## 1) Build-time production config validation

From mobile directory:

- npm run validate:prod-config

Expected result:

- Command succeeds
- No errors about missing vars
- No errors about localhost/LAN URLs
- No errors about non-HTTPS URLs

## 2) Signed iOS production build

From mobile directory:

- eas build --profile production --platform ios

Expected result:

- Build completes successfully
- No config assertion failures during Expo config resolution

## 3) Device smoke validation (production build)

Install the signed build and verify:

- app launches without crash
- login works
- task CRUD works (create, edit, complete, delete)
- task details refresh works after navigation changes
- avatar loads from backend
- analytics loads
- notifications screen loads
- no config/runtime crash while navigating major screens

## 4) API target sanity checks

Confirm from runtime behavior and logs:

- app uses production backend endpoint
- no localhost/LAN endpoint is used
- HTTPS endpoint is used in release flow

## 5) Push notification sanity (real device)

Verify on at least one physical iOS device:

- permission prompt appears once and state is respected
- device registration succeeds
- push arrives in foreground/background/terminated states
- opening push routes to expected screen

## Final Ship Gates

- [ ] Production build uses production backend
- [ ] No localhost/dev URLs in release flow
- [ ] Runtime config is validated
- [ ] Final signed production build behavior is verified

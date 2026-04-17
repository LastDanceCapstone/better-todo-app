# App Store Compliance Verification (Final)

Date: 2026-04-11
Scope: Mobile app metadata and in-app legal/support/contact destinations

## 1) Compliance Gaps Found

- App identity mismatch in config:
  - `mobile/app.json` previously used generic values (`name: mobile`, `slug: mobile`) instead of product identity.
  - Fixed app display name to `Prioritize`.
  - Kept slug as `mobile` to match existing EAS project linked by `extra.eas.projectId`.
- App Store Connect fields are not fully provable from repo alone:
  - Privacy Policy URL field value
  - Support URL field value
  - Marketing URL field value
  - Contact email shown to users in App Store Connect
  - Screenshot set and reviewer notes

## 2) In-App Destination Audit Results

Verified in app settings at `mobile/src/screens/GeneralSettingsScreen.tsx`:
- Privacy Policy link exists and opens external URL.
- Support link exists and opens external URL.
- Contact email action exists via `mailto:`.

Configured destinations:
- Privacy Policy URL: https://irradiated-sting-81f.notion.site/Privacy-Policy-Prioritize-33f12199bee38025a25cec1da24c49e0
- Support URL: https://irradiated-sting-81f.notion.site/Support-Prioritize-33f12199bee380279286c0da86e9800c
- Contact email: contact@prioritize-app.com

Reachability evidence (HTTP headers):
- Privacy URL: `HTTP/2 200`
- Support URL: `HTTP/2 200`

Placeholder/broken destination check:
- No in-app privacy/support/contact placeholders found in current settings implementation.

## 3) Metadata Consistency Audit

Product identity:
- App name now aligns with product (`Prioritize`) in `mobile/app.json`.
- Slug is intentionally `mobile` in `mobile/app.json` for EAS project linkage compatibility.

Feature claims that are supported by shipped code:
- Notifications:
  - Local permission + remote registration flows in `mobile/src/services/pushNotifications.ts`.
  - Notification settings UI in `mobile/src/screens/NotificationSettingsScreen.tsx`.
- Calendar sync:
  - Calendar permission/sync controls in `mobile/src/screens/CalendarSettingsScreen.tsx`.
  - Calendar sync service in `mobile/src/services/calendarSync.ts`.
- AI assistance:
  - AI-assisted task parsing flow in `mobile/src/screens/CreateTaskScreen.tsx`.

Privacy-related usage strings in `mobile/app.json` are consistent with implemented behavior:
- Microphone usage for voice task input.
- Calendar usage for due-date sync.
- Notification usage for reminders and summaries.

## 4) App Store Connect Manual Checklist (Required)

Use this checklist during final App Store Connect submission:

- [ ] Privacy Policy URL is set and exactly matches:
  - https://irradiated-sting-81f.notion.site/Privacy-Policy-Prioritize-33f12199bee38025a25cec1da24c49e0
- [ ] Support URL is set and exactly matches:
  - https://irradiated-sting-81f.notion.site/Support-Prioritize-33f12199bee380279286c0da86e9800c
- [ ] Marketing URL is set (choose canonical product website; do not leave blank if required by release process).
- [ ] Contact email in App Store Connect is set to:
  - contact@prioritize-app.com
- [ ] App name and subtitle in App Store Connect match shipped product identity:
  - Name: Prioritize
- [ ] Description only claims shipped features (tasks, focus mode, notifications, calendar sync, AI parsing) and avoids unverified guarantees.
- [ ] Privacy Nutrition Labels align with actual data collection/usage.
- [ ] Screenshots represent current UI and current feature set.
- [ ] Reviewer notes include test account and key review paths for notifications/calendar/AI behavior.

## 5) Safe Metadata Draft (Non-Overclaim)

Suggested short description:
- Prioritize helps you plan tasks, run focused work sessions, and stay on track with reminders and optional calendar sync.

Suggested full description:
- Prioritize is a productivity app built for focused execution. Create tasks and subtasks, organize your day, and track completion progress with clean analytics.
- Use Focus Mode for timed work sessions on one task at a time.
- Enable optional notifications for due soon, overdue, and daily summaries.
- Sync due-date tasks to Apple Calendar when you grant calendar access.
- Use AI-assisted task parsing to quickly turn natural language into structured tasks.

Claims to avoid unless separately verified in App Store Connect/legal copy:
- "Guaranteed productivity"
- "No data collected"
- "End-to-end encrypted"
- Any claim about features not present in shipped build

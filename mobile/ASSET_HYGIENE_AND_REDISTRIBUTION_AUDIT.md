# Final Asset Hygiene and Redistribution Safety Audit

Date: 2026-04-11
Scope: Shipped mobile image assets used in app branding and App Store package

## 1) Assets Audited

- `mobile/assets/adaptive-icon.png`
- `mobile/assets/favicon.png`
- `mobile/assets/icon.png`
- `mobile/assets/splash-icon.png`
- `mobile/src/components/logo/prioritize-dark.png`
- `mobile/src/components/logo/prioritize-light.png`

## 2) Metadata Found

Initial metadata scan findings:
- `mobile/src/components/logo/prioritize-dark.png`
  - Embedded XMP and EXIF metadata present.
  - Authoring/history fields included:
    - `XMP-xmp:CreatorTool` (Canva)
    - `XMP-pdf:Author`
    - `XMP-dc:Title`
    - Additional attribution/ad metadata payloads.
- `mobile/src/components/logo/prioritize-light.png`
  - Same class of embedded XMP/EXIF metadata and authoring payloads.
- `mobile/assets/*` icon/splash files
  - No risky authoring metadata found in scan output.

## 3) Cleaned Assets / Files Modified

Metadata cleanup performed with `exiftool -overwrite_original -all=`.

Updated (cleaned) files:
- `mobile/src/components/logo/prioritize-dark.png`
- `mobile/src/components/logo/prioritize-light.png`

Unchanged files (already clean/no removable tags):
- `mobile/assets/adaptive-icon.png`
- `mobile/assets/favicon.png`
- `mobile/assets/icon.png`
- `mobile/assets/splash-icon.png`

Post-clean verification:
- Re-ran exiftool metadata inspection for all six assets.
- Re-ran binary text scan for Canva/XMP/author traces.
- No remaining Canva/XMP/authoring metadata strings found in shipped branding assets.

## 4) Manual Ownership / Redistribution Checklist

The repo cannot fully prove legal ownership chain for artwork. Confirm manually before submission/distribution:

- [ ] Confirm organization owns all rights to `prioritize-dark.png` and `prioritize-light.png`.
- [ ] Confirm designer/contractor transfer terms are signed (work-for-hire or assignment).
- [ ] Confirm any source tool/template licenses (for example Canva elements/fonts) allow commercial redistribution in app binaries and App Store screenshots.
- [ ] Archive source files and export provenance in internal records (editable source, final exports, approval date).
- [ ] Confirm app icon/splash assets are either original or properly licensed for redistribution.
- [ ] Keep a lightweight asset register with owner, source, and license notes for each shipped brand asset.

## Final Status

- [x] Embedded metadata removed where appropriate
- [x] Shipped assets are clean
- [x] Redistribution/ownership concerns documented

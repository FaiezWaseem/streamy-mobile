# Build Android APK Guide

## Current Project Setup

This project is already configured for APK builds through EAS.

Relevant files:

- `eas.json`
- `app.json`
- `package.json`

Current Android package:

```text
com.faiez.streamy
```

Current EAS project:

```text
1c2748e2-585e-45f6-a934-b518e40414e4
```

## APK vs AAB

There are two Android build formats in this project:

- APK: direct install on Android phones and emulators.
- AAB: Android App Bundle for Google Play Store upload.

For testing on a phone, build the APK profile.

For Play Store release, build the production AAB profile.

## Existing `eas.json`

The current `eas.json` already has the correct APK profile:

```json
{
  "cli": {
    "version": ">= 18.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

Use `preview` when you want an APK.

## Prerequisites

Install dependencies first:

```bash
npm install
```

Check that TypeScript still passes:

```bash
npx tsc --noEmit
```

Log in to Expo/EAS:

```bash
npx eas-cli@latest login
```

Confirm the account:

```bash
npx eas-cli@latest whoami
```

This app is owned by `faiez_waseem` in `app.json`, so build from the Expo account that has access to that project.

## Build APK With EAS Cloud

Run this from the project root:

```bash
npx eas-cli@latest build -p android --profile preview
```

What this does:

- uses the `preview` profile from `eas.json`
- builds Android only
- produces an `.apk`
- uploads the build job to EAS Build
- returns a build page URL and, when complete, an APK download URL

When the build finishes, open the EAS URL and download the APK.

## Install APK On Android Device

### Option 1: Direct Download

Open the APK URL on the Android device and install it.

Android may ask you to allow installs from the browser or file manager. Enable that permission only for the install flow, then disable it again if desired.

### Option 2: Install With ADB

Connect the Android device with USB debugging enabled, then run:

```bash
adb install -r path/to/streamy.apk
```

Use `-r` to replace an existing installed version.

## Build Production AAB

Use this only when preparing a Google Play upload:

```bash
npx eas-cli@latest build -p android --profile production
```

This produces an `.aab`, not an APK.

An AAB cannot be installed directly on a phone like a normal APK.

## Optional Local APK Build

If Android Studio, Android SDK, Java, and local native build tooling are installed, EAS can also run the Android build locally:

```bash
npx eas-cli@latest build -p android --profile preview --local
```

Prefer the cloud build unless you specifically need to debug native build behavior on this machine.

## Common Build Commands

Check project health:

```bash
npx expo-doctor
```

Start Expo locally before building, useful for a quick smoke test:

```bash
npm run android
```

Build APK:

```bash
npx eas-cli@latest build -p android --profile preview
```

Build Play Store bundle:

```bash
npx eas-cli@latest build -p android --profile production
```

List recent Android builds:

```bash
npx eas-cli@latest build:list --platform android
```

## Version Notes

The app version is currently set in `app.json`:

```json
"version": "1.0.0"
```

Before sharing a new APK widely, consider bumping the version so testers can tell builds apart.

For Play Store releases, also add and increment Android `versionCode` under `expo.android` if you start submitting production builds.

Example:

```json
"android": {
  "package": "com.faiez.streamy",
  "versionCode": 2
}
```

## Troubleshooting

### `eas` Command Not Found

Use the `npx` form from this guide:

```bash
npx eas-cli@latest build -p android --profile preview
```

Or install EAS CLI globally:

```bash
npm install -g eas-cli
```

### Wrong Artifact Type

If you get an `.aab`, you used the `production` profile.

Run the APK profile instead:

```bash
npx eas-cli@latest build -p android --profile preview
```

### Build Belongs To Wrong Expo Account

Check the account:

```bash
npx eas-cli@latest whoami
```

The app config currently has:

```json
"owner": "faiez_waseem"
```

Log in with an account that can access that Expo owner/project.

## Official References

- Expo EAS APK builds: https://docs.expo.dev/build-reference/apk/
- Expo `eas.json` build profiles: https://docs.expo.dev/build/eas-json/

# Streamy Project Structure Guide

## Overview

`Streamy` is an Expo + React Native video library app with a dark, creator-focused UI. The app is built around:

- local video discovery and import
- SQLite-backed persistence for imported videos, saved videos, liked videos, and watch history
- React Navigation stack + tab flows
- a shared local-library context that turns database rows and scanned folders into app-ready video/channel models

The codebase is small and straightforward, with most product logic living under `src/`.

## Top-Level Layout

```text
streamy/
├── App.tsx
├── index.ts
├── app.json
├── eas.json
├── package.json
├── tsconfig.json
├── assets/
│   ├── adaptive-icon.png
│   ├── favicon.png
│   ├── icon.png
│   └── splash-icon.png
├── project_guide/
│   ├── graph.md
│   └── structure.md
└── src/
    ├── components/
    ├── contexts/
    ├── screens/
    └── utils/
```

## Root Files

### `App.tsx`

This is the application entry UI shell and composition root.

Responsibilities:

- initializes `expo-sqlite` via `SQLiteProvider`
- runs `migrateDbIfNeeded` on database init
- wraps the app with `NavigationContainer`
- wraps feature screens with `LocalLibraryProvider`
- defines the authenticated stack navigator
- defines the bottom tab navigator
- wires screen-to-screen navigation callbacks

Important notes:

- `Login` and `Register` types exist in `RootStackParamList`, but the current live navigator mounts only the authenticated experience.
- `MainTabs` contains five tabs: `Home`, `Channels`, `Upload`, `Reels`, `Profile`.
- stack screens layered above tabs are `Search`, `Saved`, `Video`, and `ChannelVideos`.

### `index.ts`

Expo bootstrap entrypoint that registers the app root.

### `package.json`

Defines the runtime stack:

- Expo SDK 54
- React 19
- React Native 0.81
- React Navigation
- Expo SQLite
- Expo Video
- Expo AV
- Expo Document Picker
- Expo File System
- Expo Video Thumbnails

### `app.json`

Expo application configuration.

### `eas.json`

EAS build profile configuration for cloud/native builds.

### `assets/`

Contains static branding assets used by Expo for launcher, splash, and favicon behavior.

## `src/` Directory

All feature code lives here. The directory is organized by responsibility instead of domain modules.

## `src/components/`

Reusable presentational building blocks.

### `src/components/VideoCard.tsx`

Primary reusable video preview card.

Responsibilities:

- renders a `VideoItem`
- supports three layout modes:
  - `grid`
  - `list`
  - `home`
- shows thumbnail if available
- falls back to a placeholder if no thumbnail exists
- routes presses back to parent via `onPress(video.id)`

Used by:

- `HomeScreen`
- `SearchScreen`
- `SavedScreen`
- `ProfileScreen`
- `ChannelVideosScreen`
- `VideoScreen`

### `src/components/AuthShell.tsx`

Reusable auth page shell for login and registration mock flows.

Responsibilities:

- owns local email/password form state
- validates email/password
- simulates loading and success states
- delegates completion using callback props

Used by:

- `LoginScreen`
- `RegisterScreen`

### `src/components/LabeledInput.tsx`

Thin form input wrapper.

Responsibilities:

- renders a label
- renders a styled `TextInput`
- shows validation text when `error` exists

### `src/components/StatCard.tsx`

Simple metric card used on the profile page.

### `src/components/ActionBubble.tsx`

Small icon + label action chip used by the reels overlay UI.

## `src/contexts/`

Shared state and cross-screen data orchestration.

### `src/contexts/LocalLibraryContext.tsx`

This is the most important non-UI file in the app.

Responsibilities:

- loads imported videos from SQLite
- loads cached directory video metadata from SQLite
- rescans readable directory contents only when explicitly requested
- filters entries to supported video extensions
- generates thumbnails and durations for discovered files
- converts raw video collections into `VideoItem[]`
- derives channel summaries into `ChannelItem[]`
- exposes library actions to screens

Public context API:

- `channels`
- `videos`
- `permissionGranted`
- `isLoading`
- `refreshLibrary()`
- `rescanScannedDirectories()`
- `pickDirectory()`
- `importPickedDirectory(selection, onProgress?)`
- `deleteVideo(videoId)`
- `deleteChannel(channelId)`
- `getChannelVideos(channelId)`
- `getVideoById(videoId)`

Internal concepts:

### Imported videos

These are videos explicitly saved through the `Upload` screen into SQLite. They persist across app restarts through `imported_videos`.

### Directory videos

These are videos discovered by scanning a picked folder. The picked folder path is persisted in `scanned_directories`, and each discovered video's metadata is cached in `directory_videos`. App startup reads the cached rows directly instead of regenerating thumbnails and durations for every file.

### Channel derivation

Channels are not stored as their own table. They are derived from video metadata using:

- `video.channelId`
- fallback creator/channel title mapping

### Important helper functions

- `slugifyChannelId(value)`
- `directoryChannelId(directoryUri)`
- `isVideoFileName(name)`
- `mergeDirectoryVideos(existingVideos, nextDirectoryVideos)`
- `mapVideosToChannels(videos)`

## `src/screens/`

Each file in `screens/` is a route-level UI container.

### `src/screens/HomeScreen.tsx`

Acts as the app landing page for local content.

Responsibilities:

- shows header actions
- opens search
- launches folder picker using `pickDirectory()`
- lets the user confirm a selected directory before import
- displays directory import progress
- loads last three watched videos from SQLite
- shows latest available videos from the local library
- supports `grid` and `list` display modes

Key data sources:

- `useLocalLibrary()` for library and import actions
- `getRecentVideos(db, 3)` for watch history preview

### `src/screens/ChannelsScreen.tsx`

Displays all derived channels.

Responsibilities:

- searches channels by title
- refreshes local videos
- opens a channel detail screen
- removes a channel after confirmation

Channel removal behavior:

- imported channels remove rows from `imported_videos`
- directory channels remove the saved scanned directory record

### `src/screens/ChannelVideosScreen.tsx`

Shows all videos within one channel.

Responsibilities:

- loads videos through `getChannelVideos(channelId)`
- filters channel videos by text query
- toggles `grid` / `list`
- removes the full channel

### `src/screens/SearchScreen.tsx`

Searches across the in-memory `videos` collection.

Responsibilities:

- filters by title, creator, and channel title
- supports grid and list layouts
- routes to the video detail page

### `src/screens/UploadScreen.tsx`

Handles single-video import into SQLite.

Responsibilities:

- selects a local video file through `expo-document-picker`
- accepts a direct `http` or `https` video link
- extracts duration from the selected source
- generates a thumbnail preview
- lets the user scrub thumbnail frame timing with a slider
- validates channel/title/description
- writes imported metadata to SQLite via `saveImportedVideo`
- refreshes the in-memory library after save

Primary local state:

- source selection state
- thumbnail generation state
- form fields
- validation state
- pending confirmation state

Persistence target:

- `imported_videos`

### `src/screens/ReelsScreen.tsx`

Vertical short-form playback experience.

Responsibilities:

- renders all library videos as snap-based full-screen reels
- auto-plays only the active visible reel
- pauses inactive reels
- supports tap-to-pause
- supports long-press 2x speed boost
- supports scrub seeking with a slider
- adapts `contentFit` based on thumbnail aspect ratio
- exposes quick `Like` and `Save` affordances visually

Important note:

- reel actions are mostly UI affordances right now; only the save bubble navigates to `Saved`, while persistence logic lives in `VideoScreen`.

### `src/screens/ProfileScreen.tsx`

Creator profile summary and history page.

Responsibilities:

- shows static profile header
- calculates video count from context
- calculates saved count from SQLite
- calculates total views from `recent_videos.view_count`
- loads up to eight recently watched videos
- routes to saved videos
- exposes logout callback

### `src/screens/SavedScreen.tsx`

Displays saved videos from SQLite.

Responsibilities:

- loads tracked saved videos via `getSavedVideos`
- merges DB rows with live in-memory video details when available
- renders saved entries using `VideoCard`

Persistence target:

- `saved_videos`

### `src/screens/VideoScreen.tsx`

Detailed playback page for a single video.

Responsibilities:

- resolves the target video from context
- mounts `expo-video` player with native controls
- records watch history on open
- syncs saved and liked state on focus
- toggles like persistence
- toggles save persistence
- deletes imported videos from the library
- opens related channel
- shows related videos list

Persistence touched here:

- `recent_videos`
- `liked_videos`
- `saved_videos`

### `src/screens/LoginScreen.tsx`

Thin wrapper over `AuthShell` for login copy.

### `src/screens/RegisterScreen.tsx`

Thin wrapper over `AuthShell` for registration copy.

## `src/utils/`

Utility and infrastructure helpers.

### `src/utils/database.ts`

SQLite access layer.

Responsibilities:

- database schema migration
- imported video CRUD
- scanned directory persistence
- recent watch history tracking
- liked video tracking
- saved video tracking

Current schema version:

- `PRAGMA user_version = 4`

Managed tables:

- `recent_videos`
- `imported_videos`
- `scanned_directories`
- `directory_videos`
- `liked_videos`
- `saved_videos`

Key exported functions:

- `migrateDbIfNeeded`
- `recordVideoView`
- `getRecentVideos`
- `saveImportedVideo`
- `getImportedVideos`
- `deleteImportedVideo`
- `deleteImportedVideosByChannel`
- `saveScannedDirectory`
- `getScannedDirectories`
- `saveDirectoryVideos`
- `getDirectoryVideos`
- `deleteScannedDirectory`
- `likeVideo`
- `unlikeVideo`
- `isVideoLiked`
- `getLikedVideos`
- `saveVideo`
- `unsaveVideo`
- `isVideoSaved`
- `getSavedVideos`

### `src/utils/media.ts`

Media metadata helpers.

Responsibilities:

- `formatDuration(seconds)`
- `generateThumbnail(uri, time)`
- `extractDurationInfoFromUri(uri)`
- `extractDurationFromUri(uri)`

Backed by:

- `expo-av` for duration extraction
- `expo-video-thumbnails` for thumbnail generation

### `src/utils/theme.ts`

Global design tokens and style registry.

Responsibilities:

- defines brand color palette
- exports React Navigation dark theme override
- exports large shared `appStyles` stylesheet

Visual identity:

- near-black backgrounds
- red accent system
- high-contrast text

### `src/utils/types.ts`

Shared application types.

Contains:

- navigation param lists
- auth screen prop contract
- main tab callback contract
- `VideoItem`
- `ChannelItem`

### `src/utils/data.ts`

Tiny static sample dataset. Currently low-impact and not central to the main app flow.

## Runtime Architecture

At runtime the app is driven by four layers:

1. Navigation and app shell in `App.tsx`
2. Shared library aggregation in `LocalLibraryContext`
3. Route-level screens in `src/screens/`
4. Persistence and media helpers in `src/utils/`

## Main Product Flows

### 1. Scan a folder

Flow:

- `HomeScreen`
- `pickDirectory()`
- user confirms selection
- `importPickedDirectory()`
- `saveScannedDirectory()`
- `saveDirectoryVideos()`
- thumbnails/durations generated
- cached `directoryVideos` state updated
- channels derived from videos

### 2. Upload a single file or link

Flow:

- `UploadScreen`
- document picker or URL input
- metadata extraction
- thumbnail selection
- validation
- `saveImportedVideo()`
- `refreshLibrary()`

### 3. Watch a video

Flow:

- any `VideoCard`
- `VideoScreen`
- `recordVideoView()`
- related videos shown from context

### 4. Save or like a video

Flow:

- `VideoScreen`
- `saveVideo()` or `likeVideo()`
- tracked state read through `isVideoSaved()` / `isVideoLiked()`
- counts later surfaced in `SavedScreen` and `ProfileScreen`

### 5. Remove a source

Flow:

- `VideoScreen` removes an imported video
- `ChannelsScreen` or `ChannelVideosScreen` removes a channel
- cleanup cascades through `deleteVideoReferences()`

## Design Observations

A few structural traits are worth knowing before extending the app:

- the app mixes persistent SQLite rows with derived in-memory runtime data
- channels are virtual, not first-class database entities
- scanned directory video metadata is cached in SQLite so startup can stay fast
- watch history, liked videos, and saved videos are tracked as snapshot rows rather than strict relational references
- most styling is centralized in one shared stylesheet, so visual changes usually touch `theme.ts`
- `UploadScreen` and `LocalLibraryContext` carry the heaviest feature logic

## Suggested Extension Points

If you add new features, these are the natural homes:

- new route screens: `src/screens/`
- reusable display widgets: `src/components/`
- new shared library behavior: `src/contexts/LocalLibraryContext.tsx`
- persistence or schema changes: `src/utils/database.ts`
- media processing behavior: `src/utils/media.ts`
- new app-wide models: `src/utils/types.ts`

## Quick Orientation for New Contributors

If you only need the shortest practical map:

1. Start in `App.tsx` to understand navigation.
2. Read `LocalLibraryContext.tsx` to understand where videos/channels come from.
3. Read `database.ts` to understand persistence.
4. Read `UploadScreen.tsx`, `HomeScreen.tsx`, and `VideoScreen.tsx` to understand the main product loops.
5. Read `theme.ts` before making broad UI changes.

# Streamy Architecture Graph

## Purpose

This document explains how the main parts of `Streamy` connect to each other. It complements `structure.md` by focusing on relationships, data movement, and runtime behavior instead of file-by-file inventory.

## High-Level System Graph

```mermaid
graph TD
  A[App.tsx] --> B[SQLiteProvider]
  A --> C[NavigationContainer]
  A --> D[LocalLibraryProvider]

  B --> E[database.ts]
  D --> E
  D --> F[media.ts]
  D --> G[types.ts]

  C --> H[MainTabs]
  C --> I[Stack Screens]

  H --> J[HomeScreen]
  H --> K[ChannelsScreen]
  H --> L[UploadScreen]
  H --> M[ReelsScreen]
  H --> N[ProfileScreen]

  I --> O[SearchScreen]
  I --> P[SavedScreen]
  I --> Q[VideoScreen]
  I --> R[ChannelVideosScreen]

  J --> D
  K --> D
  L --> D
  M --> D
  N --> D
  O --> D
  P --> D
  Q --> D
  R --> D

  J --> E
  L --> E
  N --> E
  P --> E
  Q --> E

  L --> F
  D --> F

  J --> S[VideoCard]
  O --> S
  P --> S
  Q --> S
  R --> S
  N --> S

  M --> T[ActionBubble]
  N --> U[StatCard]
  V[LoginScreen] --> W[AuthShell]
  X[RegisterScreen] --> W
```

## Navigation Graph

```mermaid
graph LR
  A[Authenticated Stack] --> B[MainTabs]
  A --> C[Search]
  A --> D[Saved]
  A --> E[Video]
  A --> F[ChannelVideos]

  B --> G[Home Tab]
  B --> H[Channels Tab]
  B --> I[Upload Tab]
  B --> J[Reels Tab]
  B --> K[Profile Tab]
```

## Screen-to-Screen Interaction Graph

```mermaid
graph TD
  HomeScreen -->|open search| SearchScreen
  HomeScreen -->|open video| VideoScreen
  ChannelsScreen -->|open channel| ChannelVideosScreen
  ChannelVideosScreen -->|open video| VideoScreen
  SearchScreen -->|open video| VideoScreen
  SavedScreen -->|open video| VideoScreen
  ProfileScreen -->|open saved| SavedScreen
  ProfileScreen -->|open recent video| VideoScreen
  VideoScreen -->|open related video| VideoScreen
  VideoScreen -->|open channel| ChannelVideosScreen
  ReelsScreen -->|open saved| SavedScreen
```

## Data Source Model

The app combines two primary video sources into one unified in-memory library.

```mermaid
graph TD
  A[UploadScreen] -->|saveImportedVideo| B[(imported_videos)]
  C[HomeScreen Directory Scan] -->|saveScannedDirectory| D[(scanned_directories)]
  C -->|saveDirectoryVideos| E[(directory_videos)]

  B --> F[LocalLibraryContext loadImported]
  E --> G[LocalLibraryContext loadDirectoryVideoCache]
  D --> H[LocalLibraryContext rescanScannedDirectories]
  H --> I[Directory.list]
  H --> J[generateThumbnail for new files]
  H --> K[extractDurationFromUri for new files]

  F --> L[importedVideos state]
  G --> M[directoryVideos state]
  H --> M

  L --> N[merged videos array]
  M --> N
  N --> O[mapVideosToChannels]
  O --> P[channels array]
```

## Local Library Context Graph

`LocalLibraryContext` is the central aggregator of the application.

```mermaid
graph TD
  A[LocalLibraryProvider] --> B[loadImported]
  A --> C[loadDirectoryVideoCache]
  A --> D[refreshLibrary]
  A --> E[pickDirectory]
  A --> F[importPickedDirectory]
  A --> G[deleteVideo]
  A --> H[deleteChannel]
  A --> I[getChannelVideos]
  A --> J[getVideoById]
  A --> X[rescanScannedDirectories]

  B --> K[getImportedVideos]
  C --> L[getDirectoryVideos]
  X --> M[getScannedDirectories]
  X --> N[buildDirectoryVideos for new files]
  N --> O[generateThumbnail]
  N --> Y[extractDurationFromUri]

  F --> P[saveScannedDirectory]
  F --> Z[saveDirectoryVideos]
  G --> Q[deleteImportedVideo]
  H --> R[deleteImportedVideosByChannel]
  H --> S[deleteScannedDirectory]

  B --> T[importedVideos state]
  C --> U[directoryVideos state]
  T --> V[videos memo]
  U --> V
  V --> W[channels memo]
```

## SQLite Entity Graph

```mermaid
graph TD
  A[(imported_videos)] -->|becomes| B[VideoItem imported source]
  C[(scanned_directories)] -->|tracks folder sources| D[(directory_videos)]
  D -->|becomes| N[VideoItem library source]
  E[(recent_videos)] -->|feeds| F[Home recent section]
  E --> G[Profile recently watched]
  E --> H[view count aggregation]
  I[(saved_videos)] -->|feeds| J[SavedScreen]
  I --> K[Profile saved count]
  L[(liked_videos)] -->|tracks| M[VideoScreen like state]
```

## Video Lifecycle Graph

### Flow A: Imported single video

```mermaid
sequenceDiagram
  participant U as User
  participant S as UploadScreen
  participant M as media.ts
  participant DB as database.ts
  participant C as LocalLibraryContext

  U->>S: choose local file or paste URL
  S->>M: extractDurationInfoFromUri(uri)
  S->>M: generateThumbnail(uri, time)
  U->>S: adjust thumbnail + enter metadata
  S->>DB: saveImportedVideo(...)
  S->>C: refreshLibrary()
  C->>DB: getImportedVideos()
  C->>S: updated videos/channels available app-wide
```

### Flow B: Directory-based library import

```mermaid
sequenceDiagram
  participant U as User
  participant H as HomeScreen
  participant C as LocalLibraryContext
  participant FS as expo-file-system Directory
  participant M as media.ts
  participant DB as database.ts

  U->>H: tap Scan Directory
  H->>C: pickDirectory()
  C->>FS: Directory.pickDirectoryAsync()
  FS-->>C: directory uri
  C->>FS: list files
  C-->>H: directory selection summary
  U->>H: confirm import
  H->>C: importPickedDirectory(selection)
  C->>M: generate thumbnails
  C->>M: extract durations
  C->>DB: saveScannedDirectory(...)
  C->>DB: saveDirectoryVideos(...)
  C-->>H: import result
```

### Flow C: Video playback and tracking

```mermaid
sequenceDiagram
  participant U as User
  participant VC as VideoCard/Reels/Home
  participant VS as VideoScreen
  participant DB as database.ts

  U->>VC: open video
  VC->>VS: navigate with videoId
  VS->>DB: recordVideoView(video)
  VS->>DB: isVideoLiked(videoId)
  VS->>DB: isVideoSaved(videoId)
  U->>VS: tap Like or Save
  VS->>DB: likeVideo()/saveVideo()
```

## UI Dependency Graph

```mermaid
graph TD
  A[theme.ts] --> B[all screens]
  A --> C[all components]
  D[types.ts] --> B
  D --> C

  E[VideoCard] --> F[HomeScreen]
  E --> G[SearchScreen]
  E --> H[SavedScreen]
  E --> I[ProfileScreen]
  E --> J[ChannelVideosScreen]
  E --> K[VideoScreen]

  L[AuthShell] --> M[LoginScreen]
  L --> N[RegisterScreen]
  O[StatCard] --> I
  P[ActionBubble] --> Q[ReelsScreen]
```

## Key Architectural Decisions

### 1. Unified `VideoItem` model

The UI is mostly built around one shared `VideoItem` shape, regardless of whether the video came from:

- SQLite imported rows
- a scanned directory
- saved/liked/watch-history snapshots

This keeps screen rendering simple, but it also means mapping logic is important.

### 2. Virtual channels

Channels are derived from video metadata rather than stored in a dedicated table.

Benefits:

- less schema complexity
- easy to rebuild from current videos

Tradeoff:

- channel identity depends on stable channel naming and ID generation

### 3. Hybrid persistence model

Not every visible video is stored the same way.

- imported videos are persisted as full metadata rows
- scanned directories persist folder identity, while `directory_videos` persists cached video metadata for fast startup
- saved/liked/recent rows store snapshots of video metadata for resilience

### 4. Context-centered app state

Most screens do not talk to each other directly. They coordinate through:

- navigation callbacks
- shared `LocalLibraryContext`
- shared SQLite reads/writes

## Practical Reading Order

If you want to understand the graph in code form, read in this order:

1. `App.tsx`
2. `src/contexts/LocalLibraryContext.tsx`
3. `src/utils/database.ts`
4. `src/screens/HomeScreen.tsx`
5. `src/screens/UploadScreen.tsx`
6. `src/screens/VideoScreen.tsx`
7. `src/screens/ReelsScreen.tsx`

## Change Impact Guide

Use this as a quick mental graph when editing:

- change navigation behavior: `App.tsx`, `types.ts`
- change how videos are loaded globally: `LocalLibraryContext.tsx`
- change DB schema or persistence rules: `database.ts`
- change metadata extraction or thumbnails: `media.ts`
- change the shared visual system: `theme.ts`
- change card rendering across many screens: `VideoCard.tsx`

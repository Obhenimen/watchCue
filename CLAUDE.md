# WatchCue Mobile

Social film/TV discussion app. Users follow "Hubs" (one per show/film), post reviews, discuss spoilers, and curate watchlists.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React Native 0.83 + Expo 55 |
| Routing | Expo Router (file-based) |
| Storage | react-native-mmkv |
| Icons | lucide-react-native |
| Animations | react-native-reanimated |
| Language | TypeScript (strict) |

## Directory structure

```
app/                  Route files only — no business logic here.
  _layout.tsx         Root stack (fonts, theme provider).
  index.tsx           Entry point → renders OnboardingScreen.
  (app)/
    _layout.tsx       Authenticated stack.
    (tabs)/           Bottom-tab screens (Feed, Hubs, Profile).
    movie/[id].tsx    Dynamic detail routes (push over tabs).
    post/[id].tsx
    hub/[id].tsx
    ...

features/             One directory per product feature.
  auth/
    components/       OnboardingScreen (multi-step signup).
  feed/
    components/       ForYouFeed (main feed UI).
    types.ts          Post and Reply interfaces.

components/           Shared UI used by more than one feature.
  Logo.tsx            SVG brand logo with gradient.
  PlaceholderScreen.tsx  Reusable scaffold for unimplemented screens.
  Themed.tsx          Theme-aware Text/View wrappers.
  ExternalLink.tsx    Opens URLs in the system browser.

hooks/                Shared React hooks.
  useColorScheme.ts   Returns 'light' | 'dark' from the OS.
  useColorScheme.web.ts  Web stub (always 'light').
  useClientOnlyValue.ts  Prevents SSR hydration mismatches (native).
  useClientOnlyValue.web.ts  Web version using useState/useEffect.

lib/
  api.ts              Fetch wrapper — injects Bearer token automatically.
  storage/
    mmkv.ts           Single MMKV instance (id: "watchcue-storage").
    auth.ts           Token + user persistence (get/set/clear helpers).
    index.ts          Barrel — import from "@/lib/storage".

constants/
  theme.ts            Single source of truth for colors and brand gradient.
  Colors.ts           Legacy Expo light/dark palette (used by Themed.tsx).
```

## Key rules

- **Route files are thin.** `app/` files import and render — no useState, no fetch calls.
- **Feature ownership.** New screens for a feature go in `features/<feature>/components/`. If a component is used by two features, move it to `components/`.
- **Types beside the feature.** Define types in `features/<feature>/types.ts`, not inline in the component.
- **Storage via barrel.** Always import from `@/lib/storage`, never from the sub-modules directly.
- **API client.** Use `api.get/post/delete` from `@/lib/api`. The client injects the auth token and throws on non-2xx.

## Environment

Copy `.env.example` to `.env.local` and set:

```
EXPO_PUBLIC_API_URL=http://localhost:3000   # iOS simulator / Android emulator
# EXPO_PUBLIC_API_URL=http://<lan-ip>:3000  # Physical device
```

## Running the app

```bash
npm start          # Expo dev server (scan QR with Expo Go)
npm run ios        # iOS simulator
npm run android    # Android emulator
```

## Adding a new feature

1. Create `features/<name>/` with `components/` and `types.ts`.
2. Add route files under `app/(app)/` (or `app/(app)/(tabs)/` for a new tab).
3. Keep all feature-specific state and API calls inside `features/<name>/`.
4. Export shared types from `features/<name>/types.ts`.

## Porting from WatchCueWeb

Placeholder screens reference their web counterparts. When porting:

| Mobile screen | Web source |
|---|---|
| `(tabs)/hubs` | `WatchCueWeb/src/app/components/hubs-page.tsx` |
| `(tabs)/profile` | `WatchCueWeb/src/app/components/user-profile.tsx` |
| `search` | `WatchCueWeb/src/app/components/search-explore.tsx` |
| `lists` | `WatchCueWeb/src/app/components/custom-lists.tsx` |
| `friends` | `WatchCueWeb/src/app/components/friends.tsx` |

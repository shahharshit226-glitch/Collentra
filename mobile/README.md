# Collentra — Mobile App

Phase 1 (Foundation) of the build plan: project scaffold, design system,
reusable UI primitives, and the navigation shell. No data is wired up yet
— every screen is a real, running stub. See `../docs/` for the backend
(schema, RLS, matching engine) this will connect to in Phase 2+.

## What's here

```
app/
  _layout.tsx          root layout: font loading, theme, root stack
  index.tsx             redirect stub (real auth-gate lands in Phase 2)
  (auth)/
    login.tsx            KIIT-email + Google sign-in UI (not wired yet)
    register.tsx          sign-up UI (not wired yet)
  (tabs)/
    home.tsx, discover.tsx, projects.tsx, chat.tsx, profile.tsx
                          the five tabs from spec §47, each a working
                          empty-state screen shaped like its eventual data

components/ui/          Button, Card, Input, Avatar, Badge, EmptyState,
                         ErrorState, Skeleton — the whole app is built
                         from these; no ad-hoc styled views in screens

context/ThemeContext.tsx  theme provider (colors/type/spacing), follows
                          the system light/dark setting
constants/theme.ts        the design tokens themselves
lib/supabase.ts           Supabase client, session persisted in AsyncStorage
```

## Design system

Not the generic AI-default look (warm cream + terracotta, or SaaS cards
with one border-radius and a soft grey shadow on everything). One
saturated color — Collentra Indigo — means "primary action" everywhere it
appears; coral is reserved for "something needs you" moments only.
Typography is Space Grotesk (headings/numbers) + IBM Plex Sans (body) —
picked for a technical, engineering-student character rather than a
default system sans. Border radius is differentiated by hierarchy (small
controls, medium cards, large sheets, pill badges) rather than one radius
applied everywhere. Full rationale is in the comments at the top of
`constants/theme.ts`.

## Running it

```bash
npm install
cp .env.example .env   # fill in from your Supabase project (see ../docs/SUPABASE_SETUP.md)
npx expo start
```

Scan the QR code with Expo Go (Android/iOS) or press `a` for an Android
emulator. There's nothing to sign in to yet — the app opens straight into
the Home tab.

## What was actually verified before this was handed over

This was built against real installed dependencies, not written blind:

- `npx tsc --noEmit` passes with zero errors against the full app.
- `npx expo export --platform android` successfully bundled all 1,309
  modules (every screen, every font, every icon) into a working Android
  JS bundle — the strongest confirmation possible in a sandboxed
  environment short of an actual device/simulator.
- One real type bug (`ThemeColors` was inferred too narrowly to accept
  both the light and dark palettes) was caught by the above and is
  already fixed in `constants/theme.ts`.

## What's deliberately NOT here yet (later phases)

- No Supabase calls anywhere — `signInWithPassword`, `signUp`,
  `signInWithOAuth`, and the `index.tsx` auth-gate redirect are all
  `// TODO Phase 2` comments in place, not missing by oversight.
- No skill/interest/role pickers, no project creation form (Phase 3–4).
- No matching data, no chat, no notifications (Phase 5–7).
- No settings screen / manual theme toggle — the app currently just
  follows the system's light/dark setting.

## A note on `npx expo install`

Normally you'd use `npx expo install <package>` to get Expo-SDK-compatible
versions automatically. In this environment that command couldn't reach
Expo's version-compatibility API, so every dependency here was pinned by
hand to a version published for Expo SDK 57 / React Native 0.86 (checked
directly against the npm registry, then verified by the successful bundle
export above). If you add new packages later, `npx expo install` should
work normally on your own machine — there's no reason to keep hand-pinning
once you're outside this sandbox.

# Collentra

Collentra is a student collaboration app for KIIT. It helps students find teammates by skills and interests, discover projects, manage applications, and coordinate in project or direct chats.

The repository contains an Expo mobile app and the Supabase database setup it uses. The app is built with React Native and Expo Router; Supabase provides authentication, Postgres, row-level security, storage, and realtime updates. There is no separate application server.

## Features

- KIIT student registration and sign-in with email and password.
- Student profiles, collaboration availability, and profile editing.
- Student and project discovery, including recommendations backed by database functions.
- Project creation, applications, team management, and project details.
- Connection requests and direct or project conversations.
- Light and dark themes that follow the device setting.

Some features require a configured Supabase project and its migrations. The app is under active development; see the implementation notes and database documentation linked below for current behavior and setup details.

## Requirements

- Node.js and npm.
- Expo Go on a device, or an Android/iOS simulator. Web is also available for development.
- A Supabase project for sign-in and app data.
- Supabase CLI if you want to apply migrations from the command line.

## Get started

Install the mobile app dependencies from the repository root:

```bash
npm --prefix mobile install
```

Create `mobile/.env` from the example file and add the project URL and public anon key from Supabase **Settings → API**:

```bash
cp mobile/.env.example mobile/.env
```

On Windows PowerShell, use:

```powershell
Copy-Item mobile/.env.example mobile/.env
```

Set these values in `mobile/.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

Apply the database migrations and configure Supabase Auth, using the steps in [Supabase setup](docs/SUPABASE_SETUP.md). The migrations are in `supabase/migrations/`. For the CLI workflow, from the repository root:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Start the Expo development server:

```bash
npm run start
```

Then scan the QR code with Expo Go, or start a target directly:

```bash
npm run android
npm run ios
npm run web
```

The root npm scripts delegate to `mobile/`. You can also run Expo commands from that directory, for example `npx expo start`.

## Configuration and security

The app requires both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` at startup. Expo embeds `EXPO_PUBLIC_*` values in the client bundle, so use only the Supabase public anon key. Never put a `service_role` key or other secret in the mobile app or commit it to the repository.

Configure Supabase email confirmation and the Google provider if needed, as described in [Supabase setup](docs/SUPABASE_SETUP.md). KIIT-domain enforcement, private profile data access, and authorization rules are implemented in the database as triggers, functions, and row-level security policies. Review [RLS policies](docs/RLS_POLICIES.md) before changing access behavior.

## Project layout

```text
mobile/                 Expo app, routes, UI components, Supabase client
  app/                  Expo Router screens and route layouts
  components/           Reusable interface components
  context/              Authentication, profile, and theme state
  lib/                  Supabase data access and app logic
  assets/               App icons and images
supabase/
  migrations/           Ordered database migrations
  seed_catalog.sql      Catalog seed data
  seed-demo-users.ts    Optional demo account seeder
docs/                   Architecture, database, matching, RLS, and setup docs
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Supabase setup](docs/SUPABASE_SETUP.md)
- [Database schema](docs/DATABASE.md)
- [Row-level security policies](docs/RLS_POLICIES.md)
- [Matching algorithm](docs/MATCHING_ALGORITHM.md)

## Development notes

- The Expo app configuration is in `mobile/app.json`.
- The mobile npm scripts are in `mobile/package.json`; root scripts are shortcuts to those commands.
- Database access is performed through the Supabase client and protected by database policies.
- Keep real `.env` files and student data out of version control. `.env.example` is safe to commit.

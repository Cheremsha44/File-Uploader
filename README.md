# File Uploader (Memory Caravan)

Personal cloud storage: create an account, upload files, organize them into folders, search, sort and download them. Built with Node.js, Express, Prisma and PostgreSQL. Files live in a private Supabase Storage bucket and are served through short-lived signed links.

**Live demo:** https://file-uploader-ha91.onrender.com/

> The app runs on free tiers. The first request after a period of inactivity can take up to about a minute while the server (Render) and the database (Neon) wake up. The storage project (Supabase) may also pause after a week of inactivity.

## Features

- Registration and login with hashed passwords (bcrypt) and Passport local strategy
- Sessions stored in PostgreSQL through the Prisma session store
- File upload by drag and drop or file picker, saved to private cloud storage
- Folders: create, open, upload straight into a folder
- Download through short-lived signed links
- File deletion removes both the stored object and the database record
- Search and sort (date, name, size)
- Storage usage indicator per user
- Strict per-user isolation: every query is filtered by the owner

## Tech stack

| Area         | Tools                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| Runtime      | Node.js (CommonJS)                                                          |
| Framework    | Express 5, EJS templates                                                    |
| Styling      | Tailwind CSS v4                                                             |
| Database     | PostgreSQL (Neon)                                                           |
| ORM          | Prisma 7 with the `@prisma/adapter-pg` driver adapter                       |
| Auth         | Passport (local), bcryptjs, express-session, `@quixo3/prisma-session-store` |
| File storage | Supabase Storage (private bucket)                                           |
| Uploads      | multer (memory storage)                                                     |
| Hosting      | Render (app), Neon (database), Supabase (files)                             |

## How file storage works

**Upload:** browser, then Express (login check, multer keeps the file in memory), then Supabase Storage under the key `<userId>/<random uuid><extension>`, and finally a database record with the original name, size, MIME type, storage key, owner and optional folder. If the database insert fails, the uploaded object is removed so no orphan files are left.

**Download:** the server finds the file by its id **and** the current user's id, asks Supabase for a signed link with a short expiry, and redirects the browser to it. The bucket is private, so files cannot be reached without going through the server.

**Delete:** the object is removed from storage first, then the database record.

## Data model

`User` has many `Folder` and `File`. A `File` can belong to a folder or live at the root. Each file stores its original name, size, MIME type, creation date and the object key used in storage (not a public URL). A `Session` table backs the session store. See [`prisma/schema.prisma`](prisma/schema.prisma).

## Project structure

```
app.js               app setup, middleware, server start
auth/                Passport strategy and session (de)serialization
controllers/         request handlers
lib/                 Prisma and Supabase clients
middlewares/         route guards
prisma/              schema and migrations
routes/              route definitions
src/input.css        Tailwind entry file
views/               EJS templates and partials
```

## Getting started

Requirements: Node.js 20.19 or newer, a PostgreSQL database, and a Supabase project with a private Storage bucket.

```bash
git clone https://github.com/Cheremsha44/File-Uploader
cd File-Uploader
npm install
cp .env.example .env      # then fill in the values
npx prisma migrate dev
npx prisma generate
npm run build:css         # keep this running in one terminal
npm run dev               # run the server in another terminal
```

The app starts on `http://localhost:3000`.

### Supabase setup

1. Create a project and open **Storage**, then create a bucket. Keep it **private**.
2. Open **Settings → API Keys** and copy the project URL and the **secret** key.
3. Put them in `.env`. The secret key is used only on the server and must never reach the browser or the repository.

### Environment variables

| Variable              | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string                               |
| `SESSION_SECRET`      | Long random string used to sign session cookies            |
| `SUPABASE_URL`        | Supabase project URL                                       |
| `SUPABASE_SECRET_KEY` | Supabase secret key (server only)                          |
| `SUPABASE_BUCKET`     | Name of the private bucket                                 |
| `PORT`                | Server port (default `3000`)                               |
| `NODE_ENV`            | Set to `production` in deployment to enable secure cookies |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Deployment

- **Database:** Neon (PostgreSQL)
- **Files:** Supabase Storage
- **App:** Render web service
  - Build command: `npm install --include=dev && npx prisma generate && npm run build:css:prod && npx prisma migrate deploy`
  - Start command: `node app.js`
  - Environment variables: all variables from the table above, with `NODE_ENV=production`

## Security notes

- Passwords are stored only as bcrypt hashes.
- Sessions live server-side in PostgreSQL. The session cookie is `httpOnly`, `sameSite=lax` and `secure` in production, and the app trusts the Render proxy so secure cookies work.
- Folders and files are always looked up by id **and** owner id, so requesting someone else's resource returns "not found" instead of leaking it (protection against IDOR).
- Files sit in a private bucket and are downloaded only through short-lived signed links that are created after the ownership check.
- Storage keys are generated on the server (user id plus a random UUID). The original file name is kept in the database only and is never used as a storage path.
- The Supabase secret key exists only in server environment variables, and `.env` is not committed.

## Roadmap

- Validate uploads by file content (magic bytes) and enforce the per-user quota on the server
- CSRF protection on state-changing routes, rate limiting on login, security headers (helmet)
- Nested folders, rename and move
- Shareable links with an expiry time
- Automated tests for access-control scenarios

## Author

Built by [Cheremsha44](https://github.com/Cheremsha44).

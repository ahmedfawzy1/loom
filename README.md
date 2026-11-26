# Loom

**Loom is a multi-site, multilingual headless CMS.** Editors write posts, categories, tags, author
profiles and calls to action in one admin app. Each piece of content has its own editorial
workflow and version history in every language. Your websites read only what is published through
a small, key-authenticated Content API.

One Loom install serves many sites. Each site has its own domain, languages, API keys and content
spaces.

- [Features](#features)
- [Quick start](#quick-start)
- [How it fits together](#how-it-fits-together)
- [Commands](#commands)
- [Configuration](#configuration)
- [Content model](#content-model)
- [Roles and workflow](#roles-and-workflow)
- [Content API](#content-api)
- [MCP server](#mcp-server)
- [Development notes](#development-notes)
- [Deploying](#deploying)
- [Troubleshooting](#troubleshooting)

## Features

- **Many sites, one install.** Each site has its own domain, languages, protected terms and API
  keys. Spaces (for example *Production* and *Staging*) keep separate sets of content, and a new
  space can start as a clone of an existing one.
- **21 languages out of the box.** English is the source. Every other language can be written by
  hand or machine-translated with DeepL. Brand terms are protected from translation, and Loom
  tracks which translations have fallen behind their source and which fields changed.
- **Editorial workflow.** Draft, In review, Published and Changed states, per language. Writers
  submit for review, and Authors and Admins publish. Every save is a version you can view and
  restore.
- **Rich text that stays structured.** Tiptap-based post bodies with headings, lists, tables,
  links, and embedded images, CTAs and links to other entries, all validated against one schema
  shared by the editor and the API.
- **Media library.** Uploads go straight from the browser to S3 (or MinIO locally). Loom checks
  every file's real type and dimensions on arrival, enforces per-field image rules, and keeps
  deleted images restorable.
- **Built for daily use.** Global search (`⌘K`), bulk actions, a dashboard, a review queue, a
  Trash, an activity log, and light and dark themes.
- **Content API for your websites.** Read-only, per-site API keys with rate limits. It serves only
  published content, with references resolved. When something goes live, Loom can send a refresh
  webhook to your site.
- **Draft preview.** Editors press **Preview** to see the latest saved version laid out like a
  website page, at desktop, tablet and phone widths, without publishing anything. Optionally, the
  same drafts can open inside the real website's design through its draft mode.
- **MCP server for AI assistants.** Claude, or any MCP client, can find, write and translate
  content as one person, with that person's role. It saves new versions and never publishes.

## Quick start

You need **Node 22.18+**, **pnpm 9.5+** and **Docker**.

```sh
pnpm install          # installs, generates the Prisma client, builds the shared packages
pnpm bootstrap        # starts Postgres + MinIO, applies migrations, seeds a site and an Admin
pnpm dev              # API on :4000, admin app on :3000
pnpm db:seed:demo     # optional, in a second terminal while `pnpm dev` runs: demo content
```

Open **http://localhost:3000** and sign in as `admin@example.com` with the password
`loom-local-admin`. The seed creates this Admin from `CMS_SEED_ADMIN_EMAIL` and
`CMS_SEED_ADMIN_PASSWORD` in `packages/database/.env`.

The demo content is a small company blog for "Acme" on the *Demo Site* (`example.com`). It has
three authors, three categories, five tags, two CTAs and six posts in different states
(published, edited after publishing, drafts), with Spanish and French translations, a Featured
Articles list, and an item in the Trash. It is created through the admin API, so it follows the
same rules as anything an editor makes. To start over, run `pnpm db:reset`.

### Local services

`compose.dev.yaml` runs these services as the Docker project `loom`. The ports are offset from
the defaults so Loom can run next to other stacks.

| Service       | Address                                       | Credentials               |
| ------------- | --------------------------------------------- | ------------------------- |
| Postgres 17   | `localhost:5435`, database `loom`             | `postgres` / `password`   |
| MinIO (S3)    | `http://localhost:9010`, bucket `loom-media`  | `minioadmin` / `minioadmin` |
| MinIO console | http://localhost:9011                         | `minioadmin` / `minioadmin` |

`pnpm infra:up` also creates the bucket and applies `minio/bucket-policy.json` (public reads of
`media/*` only) and `minio/lifecycle.json` (abandoned uploads expire after a day). It is safe to
run again.

## How it fits together

```text
 Editors ──► web (Next.js, :3000) ──/admin/*──► api (NestJS, :4000) ──► Postgres
                                                   │   ▲
                       browser uploads (presigned) │   │ confirm + verify
                                                   ▼   │
                                                 S3 / MinIO ──► public media URLs

 Your websites ──Bearer key──► api /content/:site/:space/... (published content only)
              ◄── refresh webhook (POST to the site's refresh URL, on publish/unpublish/...) ──

 AI assistants ──MCP token──► api /mcp (as the person who made the token; never publishes)
```

| Path                 | Package          | What it is                                                         |
| -------------------- | ---------------- | ------------------------------------------------------------------ |
| `api/`               | `@loom/api`      | NestJS API: admin endpoints, Content API, workflow, translation, media |
| `web/`               | `@loom/web`      | Next.js admin app (HeroUI, Tailwind, Tiptap, TanStack Query)       |
| `packages/database/` | `@loom/database` | Prisma schema, migrations, seed and generated client               |
| `packages/dto/`      | `@loom/dto`      | Request/response DTOs, shared constants, the rich-text schema      |
| `packages/tsconfig/` | `tsconfig`       | Shared TypeScript base configs                                     |
| `minio/`             |                  | Bucket policy and lifecycle rule (local copies of production's)    |
| `scripts/`           |                  | `seed-demo.mjs`                                                    |

The admin app never calls the API across origins. Next.js rewrites `/admin/*` to the API, so the
browser only ever talks to one origin. The API consumes `@loom/database` and `@loom/dto` as
compiled packages; the admin app consumes only `@loom/dto`. See
[Development notes](#development-notes).

## Commands

Run these from the repository root.

| Command                           | What it does                                                       |
| --------------------------------- | ------------------------------------------------------------------ |
| `pnpm bootstrap`                  | First run: `infra:up`, then `db:migrate`, then `db:seed`           |
| `pnpm dev`                        | API and admin app together (`dev:api`, `dev:web` run one)          |
| `pnpm infra:up` / `infra:down`    | Start / stop Postgres and MinIO. Data is kept in Docker volumes    |
| `pnpm infra:logs`                 | Follow the infrastructure logs                                     |
| `pnpm db:migrate`                 | Apply pending migrations                                           |
| `pnpm db:migrate:dev`             | Create a migration after editing `schema.prisma`                   |
| `pnpm db:seed`                    | Base seed: Demo Site, its languages, a Production space, an Admin. Safe to re-run |
| `pnpm db:seed:demo`               | Demo content. Needs the API running; refuses to run twice          |
| `pnpm db:reset`                   | Drop all data, re-apply migrations, re-run the base seed           |
| `pnpm db:studio`                  | Prisma Studio                                                      |
| `pnpm admin:invite <email>`       | Make someone an Admin and print a one-time link to choose a password. How a new install gets its first Admin, and how a locked-out Admin gets back in |
| `pnpm build:packages`             | Rebuild `@loom/database` and `@loom/dto`                           |
| `pnpm build`                      | Build everything for production                                    |
| `pnpm start:api` / `start:web`    | Run the production builds                                          |
| `pnpm typecheck`                  | Type-check the API and the admin app                               |
| `pnpm test`                       | API unit tests (Vitest)                                            |
| `pnpm lint` / `lint:fix`          | Biome                                                              |

## Configuration

Each package reads its own `.env`. The `.env.example` files list every variable with comments;
copy them to `.env` to start. The examples already point at the local services above.

**`api/.env`**

| Variable                                 | Purpose                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `NODE_ENV`                               | `development` locally, `production` when deployed                       |
| `PORT`                                   | API port (default `4000`)                                               |
| `CMS_DATABASE_URL`                       | Postgres connection string                                              |
| `S3_ENDPOINT`                            | MinIO's URL locally. Unset it in production to use AWS S3               |
| `S3_BUCKET`, `S3_REGION`, `S3_PUBLIC_URL`| Media bucket, its region, and the public base URL images are served from |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Storage credentials                                                 |
| `DEEPL_API_KEY`                          | Machine translation. Free-tier keys (ending `:fx`) use DeepL's free API automatically |
| `DEEPL_API_URL`                          | Optional: a proxy or local stand-in for DeepL                           |

**`packages/database/.env`**

| Variable                                          | Purpose                                                    |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `CMS_DATABASE_URL`                                | Used by Prisma's CLI for migrations and seeds              |
| `CMS_SEED_ADMIN_EMAIL`, `CMS_SEED_ADMIN_PASSWORD` | Local only: the Admin `pnpm db:seed` creates, and `pnpm db:seed:demo` signs in as. There is no default in code |
| `CMS_ADMIN_URL`                                   | Where the admin app is served, for the link `pnpm admin:invite` prints (`--url` overrides it) |

**`web/.env`**: `CMS_API_URL`, the API origin that `/admin/*` is forwarded to (default
`http://localhost:4000`).

In production the API refuses to start if a required variable is missing or still says
`REPLACE_ME`, or if `S3_ENDPOINT` points at localhost.

## Content model

```text
Site            a website: domain, default language, enabled languages, protected terms,
 │              refresh URL + secret, API keys
 └─ Space       a separate set of content within a site (Production, Staging, ...)
     ├─ Blog posts         title, description, slug, summary, body, FAQ, image,
     │                     author, reviewer, category, tags
     ├─ Categories         title, description, SEO title/description, images
     ├─ Tags               title, description, image
     ├─ Authors            name, job title, bio, photo, social links
     ├─ CTAs               title, description, button label, URL, campaign id, image
     └─ Featured Articles  an ordered list of up to 10 posts, per language
Media library   shared by every site
```

Admins add and remove sites in **Settings → Sites**. A new site starts with all 21 languages
enabled and a *Production* space. Its slug and default language are fixed once it's created,
because websites ask for content by the slug and translations are based on the default language.
Deleting a site permanently removes its spaces, all their content, its languages and its API
keys, which stop working at once. Images stay in the shared library. Loom always keeps at least
one site.

Every item has **shared fields** (slug, relations, images), which are the same in every language,
and **per-language fields** (the text). Each language of an item has its own status and version
history. Shared fields are edited from the site's default language and go live when that language
is published.

A CTA's URL must be a relative `/path` or an `https` URL on its site's domain or a subdomain of
it. CTAs render inside published pages, so anything else would be an open redirect.

## Roles and workflow

People sign in with their email and a password. Nobody can sign up on their own: an Admin adds
each person in **Users** with the role they need, and Loom gives the Admin a one-time link to send
them. The person opens it, chooses a password, and is signed in. Until then the account shows as
**Invited**.

- **Forgot a password:** an Admin clicks **Reset password** next to that person and sends them the
  new link. Their old password keeps working until they choose a new one. There is no
  self-service reset, because Loom sends no email.
- **Links:** each works once, for 7 days, and is shown only when it's made. A new link replaces
  the person's previous one. Send it to that person only: whoever opens it can set the password.
- **Changing your own password:** **Settings → Account**. It signs you out everywhere else.
- **Roles and access:** an Admin can change anyone's role at any time, and it applies from their
  next click. **Disable** signs the person out at once; **Reactivate** lets them back in with the
  password they had. Loom always keeps at least one active Admin.
- **Sessions** last 30 days from the last time they were used. A password needs at least 12
  characters. After 10 wrong passwords for one email, that email can't sign in for 15 minutes.

| Role   | Can                                                                                       |
| ------ | ----------------------------------------------------------------------------------------- |
| Admin  | Everything an Author can, plus Settings (sites, spaces, languages, protected terms, refresh URL, API keys) and Users |
| Author | Create and edit everything, publish, unpublish, approve or send back submissions, restore versions, delete for good from the Trash |
| Writer | Create and edit, restore versions, translate, submit for review, move to and restore from the Trash. Cannot publish |

Each language of an item moves through these states:

```text
Draft ──submit──► In review ──approve──► Published ──edit──► Changed ──publish──► Published
  └──────────────────── publish (Authors, Admins) ─────────────────────┘
```

What readers see is always the **published version**. Editing a live item creates a new version
but changes nothing on the site until it is published again. Publishing is refused while
something the item depends on (its author, category, tags or embedded CTAs) is not live; the
editor lists those and can publish them first.

## Content API

Your website calls this API from its server. Never call it from a browser: the key would be
exposed.

1. In Loom, open **Settings → API keys** (Admin) and create a key for the site. It starts with
   `loom_` and is shown only once.
2. Send it as a bearer token:

```sh
curl -H "Authorization: Bearer loom_..." \
  "http://localhost:4000/content/demo/production/blogs?locale=en&pageSize=10"
```

Every endpoint is a `GET`, takes the site and space by slug, and needs `locale`, which must be
one of the site's enabled languages.

| Endpoint                                  | Returns                                                         |
| ----------------------------------------- | --------------------------------------------------------------- |
| `/content/:site/:space/blogs`             | Published posts, newest first. `page`, `pageSize` (≤ 100), and filters `category` (slug), `tag` (slug), `author` (id) |
| `/content/:site/:space/blogs/:slug`       | One post: body, FAQ, byline, category, tags, `alternates` (the same post in other languages) and `includes` (the media, CTAs and entries its body refers to) |
| `/content/:site/:space/categories[/:slug]`| Categories                                                      |
| `/content/:site/:space/tags[/:slug]`      | Tags                                                            |
| `/content/:site/:space/authors[/:id]`     | Authors                                                         |
| `/content/:site/:space/featured-articles` | The Featured Articles list for that language                    |

- Responses are wrapped as `{ "success": true, "data": ... }`.
- Content that isn't published in the requested language returns a 404. The website decides
  whether to fall back to another language.
- Referenced content (a post's author, category, tags) falls back to the default language when
  it isn't published in the requested one. Each reference carries the `languageCode` it came
  from, so link to it in that language.
- A reference to something no longer live is left out of `includes`; render it as nothing.
- Each key has a rate limit (600 requests a minute by default). A wrong, unknown or revoked key
  gets a `401`, and going over the limit gets a `429`.

### Refresh webhook

Set a site's **refresh URL** and **secret** in **Settings → Sites**. Whenever what is live
changes, Loom sends a `POST` to that URL with the secret in a `secret` header:

```json
{
  "site": "demo",
  "space": "production",
  "event": "publish",
  "type": "blogs",
  "id": "cm...",
  "targets": [{ "locale": "en", "slug": "cutting-page-load-times" }]
}
```

`event` is one of `publish`, `unpublish`, `trash`, `restore`, `media`, `settings` or `bulk`.
Changes that affect many pages send `"all": true` instead of `targets`. Loom never waits on the
webhook: if the website is down, the change still goes live and the failure is logged. Admins and
Authors can also send a full refresh from **Settings**. In production the URL must use `https`.

### Draft preview

In the editor for a post, category, tag or author, **Preview** saves any unsaved changes and opens
Loom's preview page in a new tab (`/preview/{type}/{id}?language=en`). It shows the **latest saved
version** laid out like a website page: post body with its images, CTAs and links, byline, FAQ and
tags; a category's, tag's or author's posts; and how a category may look in search results. The
data comes from the same code as the Content API's preview mode, so it is exactly what a website
would receive. No website or setup is needed.

- The top bar shows the status in that language, and a banner says what the website shows instead
  (for example, the previously published version of a Changed post).
- Switch languages, check **Desktop**, **Tablet** and **Phone** widths (`&view=phone` in the URL
  opens it that way), or jump back to **Edit**.
- The page refreshes when you return to its tab, so save in the editor and switch tabs to see the
  change.
- Anything the website would leave out, such as a CTA with no version in that language, is shown as
  a note so it can be fixed before publishing.
- Every role can preview.

#### Previewing on your own website (optional)

To also see a draft inside your real website's design, connect the website's draft mode. The
preview page then shows **Open on website**. It takes two pieces:

1. **A preview URL.** In **Settings → Sites**, set the site's **Preview URL**: a route on your
   website that turns on draft mode, such as `https://example.com/api/preview`.
2. **A key that can read drafts.** In **Settings → API keys**, create a second key with
   **Can read drafts** ticked. Keep it on the website's server next to the normal one. Normal keys
   are refused (`403`) when they ask for drafts.

**Open on website** opens `<preview URL>?token=…`. The token is signed per site, names one item in
one language and expires after an hour. Your preview route trades it for the page to show, using
the draft-reading key:

```http
GET /content/:site/:space/preview?token=…
→ { "type": "blog", "id": "cm…", "languageCode": "en", "slug": "my-post", "expiresAt": "…" }
```

`type` is `blog`, `category`, `tag` or `author` (authors have no slug; route them by `id`). A
tampered or expired token gets a `401`, and a token for another space a `400` that names it.

While draft mode is on, the website adds `preview=true` to every Content API call and uses the
draft-reading key. Every endpoint then serves the **latest saved version** of everything instead of
the published one: new drafts, unpublished edits and translations. Shared fields still come from
the default language, and nothing in the Trash appears. Preview responses carry
`Cache-Control: private, no-store` and `X-Loom-Preview: true`, so they never land in a shared cache.

For example, in a Next.js website:

```ts
// app/api/preview/route.ts
import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

const LOOM = `${process.env.LOOM_URL}/content/my-site/production`;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const response = await fetch(`${LOOM}/preview?token=${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${process.env.LOOM_PREVIEW_KEY}` },
    cache: "no-store",
  });
  if (!response.ok) return new Response("This preview link is invalid or expired", { status: 401 });

  const { data } = await response.json();
  (await draftMode()).enable();
  redirect(data.type === "blog" ? `/${data.languageCode}/blog/${data.slug}` : "/"); // your routes
}

// Wherever the site reads content:
const { isEnabled } = await draftMode();
const key = isEnabled ? process.env.LOOM_PREVIEW_KEY : process.env.LOOM_API_KEY;
const post = await fetch(`${LOOM}/blogs/${slug}?locale=en${isEnabled ? "&preview=true" : ""}`, {
  headers: { Authorization: `Bearer ${key}` },
  cache: isEnabled ? "no-store" : "force-cache",
});
```

## MCP server

The API serves an [MCP](https://modelcontextprotocol.io) server at `/mcp` (Streamable HTTP), so an
AI assistant such as Claude can work in Loom the way an editor does. It acts as one person, with
that person's role, and everything it saves is recorded as theirs in the version history and the
activity log.

**Connecting.** Each person makes their own token in **Settings → MCP**. A token starts with
`loom_mcp_`, is shown once, and works for 90 days or until it is revoked; it stops working at once
if its owner is disabled. That page also shows the URL to use: the admin app forwards `/mcp` to the
API, the way it forwards `/admin/*`. For Claude Code:

```sh
claude mcp add --transport http loom https://<admin app>/mcp --header "Authorization: Bearer loom_mcp_..."
```

A token is needed locally too: sign in, make one in **Settings → MCP**, and use
`http://localhost:3000/mcp` (or the API's own `http://localhost:4000/mcp`).

**Tools.**

| Tools | What they do |
| ----- | ------------ |
| `list_sites` | Sites with their languages and spaces. Start here: the other tools take a `spaceId` |
| `list_*`, `get_*`, `create_*`, `save_*` for posts, categories, tags, authors and CTAs | Read and write content. A save sends only the fields to change. Naming a language the item doesn't have yet adds a translation |
| `get_featured_posts`, `save_featured_posts` | One language's Featured Articles list |
| `search`, `list_media`, `list_activity`, `list_review_queue` | Find content, pick pictures by id, see history and what is waiting for review |
| `submit_for_review` | Writers only: send one language to the review queue |

A save through MCP is held to the same rules as one from the editor: the same validation, versions
and statuses. It never publishes. On a live item, a save is a new version that stays off the site
until a person publishes it. Publishing, unpublishing, the Trash, permanent deletion, restoring
versions, machine translation and uploading pictures are left to people in Loom. Every answer about
an item includes its `editorPath`, the page to open it on.

## Development notes

- **Shared packages are compiled.** `@loom/database` and `@loom/dto` are used from their `dist`
  builds. After changing `schema.prisma` or anything in `packages/dto`, run
  `pnpm build:packages`. To change the schema, run `pnpm db:migrate:dev` first; it creates the
  migration and applies it.
- **The admin app never imports `@loom/database`.** It gets database types and enums from
  `@loom/dto/models`. To use another one in the app, add it there; `web/biome.json` rejects a
  direct import.
- **Shared versions live in `pnpm-workspace.yaml`.** The TypeScript, zod, Prisma and Tiptap
  versions are set in its catalogs, and each `package.json` refers to them as `catalog:` or
  `catalog:<name>`. Change a version there, not in a `package.json`.
- **Windows:** stop the API before `pnpm build:packages` or a migration. A running API holds
  Prisma's query engine open, and `prisma generate` fails with `EPERM`.
- **Rich text:** the body schema lives in `packages/dto/src/rich-text`. The editor is built from
  it, and the API rejects any body that doesn't fit it. Add a node or mark there, not in either
  app.
- **Tests and checks:** `pnpm test`, `pnpm typecheck` and `pnpm lint` should all pass before a
  change goes in.
- **Sign-in works the same locally as in production.** There is no development shortcut: you sign
  in as the seeded Admin. Locally the session cookie is sent over plain HTTP; in production
  (`NODE_ENV=production`) it is `Secure`, so it needs HTTPS.
- **Credentials have one definition.** Password hashing (scrypt), token hashing and email
  normalisation live in `@loom/database/credentials`, shared by the API, the seed and
  `pnpm admin:invite`. It is a subpath of its own because it needs `node:crypto`, which must not
  reach the admin app's browser bundle.

## Deploying

Loom runs with the API as **a single instance**: API key rate limits, the key cache and the
sign-in limits are kept in memory. The admin app must be served over **HTTPS**, because the
session cookie is only sent over HTTPS in production.

1. **Database:** Postgres with the `pg_trgm` extension available. Run `pnpm db:migrate`. Don't
   run the seed in production; it creates the demo site.
2. **Storage:** an S3 bucket with:
   - a bucket policy allowing public `s3:GetObject` on `media/*` only (see
     `minio/bucket-policy.json`): no listing, and nothing under `pending/`;
   - the lifecycle rule in `minio/lifecycle.json`;
   - a CORS rule allowing `POST` from the admin app's origin, or browser uploads fail;
   - an IAM user with Get, Put and Delete on `pending/*` and `media/*`.
3. **In front of it:** a load balancer or CDN that terminates HTTPS for the admin app and sets
   `X-Forwarded-For`. The API limits failed sign-ins per email always, and per client address
   only when that header is there. Websites call `/content/*` and MCP clients call `/mcp` with
   their own keys and tokens, not a session. If a CDN such as Cloudflare sits in front, add a
   rate-limit rule on `/content/*` and on `/admin/auth/*`.
4. **Environment:** `NODE_ENV=production`, the real S3 settings with `S3_ENDPOINT` unset, and a
   DeepL key.
5. **Build and run:** `pnpm build`, then `pnpm start:api` and `pnpm start:web`. Set
   `CMS_API_URL` for the admin app to the API's internal address. `GET /health` reports whether
   the API is up.
6. **First Admin:** wherever `pnpm db:migrate` runs, run

   ```sh
   pnpm admin:invite you@yourcompany.com --name "Your Name" --url https://cms.yourcompany.com
   ```

   It prints a one-time link. Open it, choose a password, and you're signed in. From then on,
   you add sites in **Settings → Sites** and people in **Users**. The same command gets an Admin
   back in if they're locked out: it re-enables the account, makes it an Admin, and prints a new
   link.

## Troubleshooting

| Symptom                                                    | Fix                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm setup` does something unrelated                       | That is pnpm's own command. The first-run script is `pnpm bootstrap` |
| `prisma generate` fails with `EPERM` on Windows             | Stop the API, then run the command again                            |
| A type or field change in `packages/` isn't picked up       | `pnpm build:packages`                                               |
| `pnpm db:seed:demo` says it can't reach the API             | Start it with `pnpm dev` or `pnpm dev:api` first                    |
| Port 5435, 9010 or 9011 is taken                            | Change the host ports in `compose.dev.yaml` and the matching URLs in `api/.env` and `packages/database/.env` |
| Uploads fail in production at the browser's preflight      | The bucket needs a CORS rule allowing `POST` from the admin origin  |
| Translate says DeepL isn't configured                       | Set `DEEPL_API_KEY` in `api/.env` and restart the API               |
| An MCP client can't connect                                 | It must send `Authorization: Bearer loom_mcp_…` (from **Settings → MCP**), locally too |
| Signing in seems to work, then you're back on the sign-in page | In production the session cookie needs HTTPS. Serve the admin app over HTTPS |
| `pnpm db:seed` says to set `CMS_SEED_ADMIN_EMAIL`           | Add it and `CMS_SEED_ADMIN_PASSWORD` to `packages/database/.env` (see its `.env.example`) |
| "Too many failed attempts"                                  | Wait 15 minutes, or ask an Admin for a password link              |
| Every Admin is locked out                                   | `pnpm admin:invite their@email` prints a new link and re-enables the account |
| The preview page has no **Open on website**                 | The site has no preview URL. An Admin sets it in **Settings → Sites → Draft preview** |
| The website gets `403` with `preview=true`                  | That key can't read drafts. Create one with **Can read drafts** in **Settings → API keys** |

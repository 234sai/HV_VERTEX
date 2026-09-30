# HV Vertex Electronics — Cloudflare Production Package

This package is the Cloudflare-ready version of the approved **HV-Vertex-Website-FINAL** website.

## Architecture

```text
Browser
  │
  ├── Static pages + images ──> Cloudflare Workers Static Assets
  │
  └── /api/* ────────────────> Cloudflare Worker
                                  │
                                  ├── CSRF protection
                                  ├── rate limiting
                                  ├── validation
                                  └── Cloudflare Email Service
                                           │
                                           └── hr@hvvertex.in
```

Cloudflare Workers Static Assets can deploy the static frontend and Worker code together as one deployment. The project uses the current `assets` configuration rather than the deprecated Workers Sites model.

## Project structure

```text
HV-Vertex-Website-Cloudflare/
├── public/
│   ├── index.html
│   ├── products.html
│   ├── students.html
│   ├── about.html
│   ├── careers.html
│   ├── contact.html
│   ├── 404.html
│   └── assets/
│       ├── images/
│       └── js/api.js
├── src/
│   └── index.js
├── wrangler.jsonc
├── package.json
├── .dev.vars.example
├── .gitignore
└── README.md
```

No Node/Express server is required in production. There is no MongoDB, SMTP password, Nodemailer, Google authentication, or server-side `.env` in this package.

## Website routes

- `/`
- `/products`
- `/students`
- `/about`
- `/careers`
- `/contact`

## API routes

- `GET /api/health` — Worker health check
- `GET /api/csrf` — creates the CSRF token/cookie used by form submissions
- `POST /api/contact` — contact/quote enquiries
- `POST /api/students` — academic student discount applications with student-proof attachment
- `POST /api/careers` — job applications with downloadable PDF resume attachment

## Email delivery

The Cloudflare version no longer uses Titan SMTP directly. It uses **Cloudflare Email Service's native Worker email binding**.

The configured sender and destination are:

```text
From: hr@hvvertex.in
To:   hr@hvvertex.in
```

The visitor's email is sent as `Reply-To`, so the business can reply directly to the person who submitted the form.

### Before deployment

Cloudflare Email Service requires the sending domain to be onboarded in Cloudflare Email Service. The domain must use Cloudflare DNS. Cloudflare will configure the required email-authentication records during onboarding. The destination address must also be verified where required.

For this project, onboard:

```text
hvvertex.in
```

and use:

```text
hr@hvvertex.in
```

as the verified destination/sender.

The binding is intentionally restricted to that sender and destination in `wrangler.jsonc` so the Worker cannot accidentally send website submissions somewhere else.

## Install

Use a current Node.js release, then run:

```bash
npm install
```

This installs Wrangler from `package.json`.

## Validate the project

```bash
npm run check
npm run dry-run
```

`npm run check` validates the Worker and browser API JavaScript. `npm run dry-run` asks Wrangler to validate the deployment bundle without publishing it.

## Local Cloudflare development

For frontend/API testing without sending real email:

```bash
npm run dev
```

For testing the actual Cloudflare Email Service binding and sending real messages from local Wrangler development:

```bash
npm run dev:remote
```

Remote email development requires you to be authenticated with Wrangler and to have the Email Service binding/domain configuration available in the Cloudflare account.

## Deploy

Authenticate Wrangler:

```bash
npx wrangler login
```

Then deploy:

```bash
npm run deploy
```

Wrangler will deploy the Worker and static assets together.

## Form behavior

### Contact form

Sends all contact/quote fields to `hr@hvvertex.in`.

### Student discount form

Collects:

- name
- email
- phone
- college/university
- course/branch/year
- hardware/components required
- optional project/purpose
- student ID or bonafide proof

The uploaded PDF/JPG/PNG is attached to the email as a downloadable attachment.

### Career form

The selected job card automatically preselects the same role in the application form. The uploaded PDF resume is attached to the email as a downloadable attachment.

## Security

- Same-origin API only
- CSRF token + HttpOnly cookie
- Origin validation
- Cloudflare rate limiting bindings
- File-type and file-size validation
- HTML escaping for submitted content
- Safe email subjects
- Security response headers
- No credentials stored in frontend code
- No SMTP credentials included in the repository

Resume and student-proof uploads are limited to 5 MB each. Cloudflare Email Service supports attachments through the Worker email binding; the binding is used directly rather than building SMTP connections inside the Worker.

## Important Cloudflare setup note

The ZIP is **deployment-ready**, but Cloudflare account/domain configuration is outside the files themselves. Before the first production deployment, complete the Email Service onboarding for `hvvertex.in` and verify `hr@hvvertex.in` as required by the Cloudflare dashboard.

Do not put the previous Titan SMTP password into this project. It is not needed by the Cloudflare Worker.

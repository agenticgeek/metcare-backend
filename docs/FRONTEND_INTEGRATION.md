# MET Academy — Student Portal: Frontend API integration

This document is for the **React (or other) student SPA** that talks to the **MET Academy Student API** (this backend). It lists every endpoint, payloads, cookies, headers, and response shapes so you can integrate without reading server source.

**OpenAPI (Swagger):** `{API_ORIGIN}/api/docs` and `{API_ORIGIN}/api/docs.json` — use for interactive exploration.

---

## 1. Configuration

| Item | Description |
|------|-------------|
| **API origin** | e.g. `https://api.yourdomain.com` or `http://localhost:5001` — no trailing slash. |
| **API prefix** | All routes below are under **`/api`**. Full login URL: `{API_ORIGIN}/api/auth/login`. |
| **CORS** | The server allows **one** origin: `FRONTEND_URL` from backend env. Your SPA origin must match exactly (scheme + host + port). |
| **Cookies** | Session is an **httpOnly** cookie named **`student_session`**. The browser stores it; **JavaScript cannot read it**. |
| **Credentials** | Every browser request to this API must send **`credentials: 'include'`** (Fetch) or **`withCredentials: true`** (Axios), or cookies will not be sent/received. |
| **`Accept-Language`** | Optional on **auth** routes. Send **`fr`** or **`en`** (e.g. `Accept-Language: fr`) so error and success **messages** match the UI locale. Module routes ignore this for most errors (English). |

### Local dev: different ports (e.g. SPA `:3000`, API `:5001`)

Cookies set by `localhost:5001` are **not** sent to `localhost:3000` (different origins). Use one of:

- **Dev proxy:** proxy `/api` from the Vite/Webpack dev server to the API (SPA and browser see one origin), or  
- **Same host** via tunnel / reverse proxy in dev.

In **production**, put the SPA and API on a **same-site** setup (e.g. reverse proxy: `https://app.example.com` + `https://app.example.com/api` → Node) or plan **cookie `Domain`** with your backend team if API is on a subdomain.

---

## 2. Response envelope

All JSON responses use this shape unless noted.

**Success (2xx):**

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

**Error (4xx / 5xx):**

```json
{
  "success": false,
  "message": "Human-readable message"
}
```

There is no `errors[]` array; read **`message`**. Validation failures are often **400** with `message` starting with `Validation failed. …`.

---

## 3. Auth API — `POST` / `GET` under `/api/auth`

Cookie **`student_session`** is **set** on successful **login**, **activate**, and **reset-password**. It is **cleared** on **logout**. **`POST /api/auth/register`** does not set a session cookie.

### 3.0 `POST /api/auth/register`

| | |
|--|--|
| **Body** | `{ "email", "full_name", "password", "confirm_password" }` |
| **Rules** | Password min **8** characters; passwords must match. |
| **Success 201** | `data`: `{ id, full_name, email }`. Activation email sent (no cookie until **activate**). |
| **409** | Email already registered. |
| **502** | Email delivery failed (account not kept). |

### 3.1 `POST /api/auth/login`

| | |
|--|--|
| **Body** | `{ "email": string, "password": string }` |
| **Headers** | `Content-Type: application/json`. Optional: `Accept-Language: fr` \| `en`. |
| **Success 200** | `data`: `{ "id", "full_name", "email" }`. Sets **`student_session`**. |
| **401** | Wrong email/password (same generic `message`; do not reveal which field failed). |
| **403** | **Pending** activation or **disabled** account — **different** `message` each (localized with `Accept-Language`). |

**Example (Fetch):**

```ts
await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': locale === 'fr' ? 'fr' : 'en',
  },
  credentials: 'include',
  body: JSON.stringify({ email, password }),
});
```

---

### 3.2 `GET /api/auth/token-check` (read-only)

Use on **`/activate`** and **`/reset-password`** **mount** to decide form vs error **without** submitting a password. Does **not** consume the token.

| | |
|--|--|
| **Query** | **`token`** (required). **`type`**: `activation` (default) or `reset`. |
| **Success 200** | Always success envelope: `data: { "status": "valid" \| "invalid" \| "used" \| "expired" }`. |
| **400** | Missing/invalid query params (validation). |

**Example:**

```ts
const q = new URLSearchParams({ token, type: 'activation' });
const res = await fetch(`${API}/api/auth/token-check?${q}`, { credentials: 'include' });
const body = await res.json();
// body.success && body.data.status === 'valid' → show set-password form
```

---

### 3.3 `POST /api/auth/activate`

| | |
|--|--|
| **Body** | `{ "token": string, "password": string, "confirm_password": string }` |
| **Rules** | Passwords must match; password **min 8** characters. |
| **Success 200** | `data`: user profile `{ id, full_name, email }`. Sets **`student_session`**. |
| **400** | Invalid / used / expired token, or validation (localized `message` where applicable). |

Token usually comes from the URL: `/activate?token=...` — pass the raw token string in the body.

---

### 3.4 `POST /api/auth/forgot-password`

| | |
|--|--|
| **Body** | `{ "email": string }` |
| **Success 200** | **Always** the same `message` (security: no email enumeration). `data` is often `null`. Optional: `Accept-Language`. |
| **Note** | Email is only sent if an **active** account exists; the response does not reveal that. |

---

### 3.5 `POST /api/auth/reset-password`

| | |
|--|--|
| **Body** | `{ "token": string, "password": string, "confirm_password": string }` |
| **Rules** | Same as activate (match + min 8). Token type is **reset** (from email link). |
| **Success 200** | `data`: user profile. Sets **`student_session`**. |
| **400** | Invalid / used / expired reset token or validation. |

---

### 3.6 `POST /api/auth/logout`

| | |
|--|--|
| **Body** | _(empty)_ |
| **Success 200** | Clears **`student_session`**. |

---

## 4. Modules API — under `/api/modules`

All routes require a valid **`student_session`** cookie (logged-in student). If missing or invalid:

```json
{ "success": false, "message": "Unauthorized" }
```

HTTP **401**.

### 4.1 `GET /api/modules`

| | |
|--|--|
| **Success 200** | `data`: **array** of published modules, sorted by **`order_index`** ascending. |
| **Each item** | `id`, `order_index`, `title`, `description`, `duration_seconds`, `thumbnail_url` (nullable) — **no `video_id`**. |

Use this for the dashboard grid and for sidebar ordering.

---

### 4.2 `GET /api/modules/:id/token`

| | |
|--|--|
| **Path** | `:id` = module **UUID** (same as `id` from list). |
| **Success 200** | `data`: `{ "token": "<Cloudflare signed JWT string>" }` — **~2 hours** validity. |
| **401** | No/invalid session. |
| **404** | Module missing or not published. |
| **502** | Cloudflare token generation failed; show a generic retry message. |

**Playback:** Build the Stream iframe URL on the client per Cloudflare docs, e.g.  
`https://iframe.cloudflarestream.com/{token}`  
(confirm against current Cloudflare Stream “signed URLs” documentation.) **`video_id` is never returned** by the API.

---

## 5. Minimal API client (TypeScript-friendly)

```ts
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';

type Locale = 'fr' | 'en';

async function studentApi(
  path: string,
  options: RequestInit & { locale?: Locale } = {}
) {
  const { locale = 'en', headers, body, ...rest } = options;
  const hdrs: Record<string, string> = {
    'Accept-Language': locale,
    ...(headers as Record<string, string> | undefined),
  };
  if (body != null) hdrs['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    ...rest,
    body,
    headers: hdrs,
    credentials: 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message ?? res.statusText);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }
  return body as { success: true; data: unknown; message: string };
}

export const auth = {
  register: (
    email: string,
    full_name: string,
    password: string,
    confirm_password: string,
    locale?: Locale
  ) =>
    studentApi('/api/auth/register', {
      method: 'POST',
      locale,
      body: JSON.stringify({ email, full_name, password, confirm_password }),
    }),

  login: (email: string, password: string, locale?: Locale) =>
    studentApi('/api/auth/login', {
      method: 'POST',
      locale,
      body: JSON.stringify({ email, password }),
    }),

  tokenCheck: (token: string, type: 'activation' | 'reset' = 'activation', locale?: Locale) =>
    studentApi(`/api/auth/token-check?${new URLSearchParams({ token, type })}`, {
      method: 'GET',
      locale,
    }),

  activate: (token: string, password: string, confirm_password: string, locale?: Locale) =>
    studentApi('/api/auth/activate', {
      method: 'POST',
      locale,
      body: JSON.stringify({ token, password, confirm_password }),
    }),

  forgotPassword: (email: string, locale?: Locale) =>
    studentApi('/api/auth/forgot-password', {
      method: 'POST',
      locale,
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string, confirm_password: string, locale?: Locale) =>
    studentApi('/api/auth/reset-password', {
      method: 'POST',
      locale,
      body: JSON.stringify({ token, password, confirm_password }),
    }),

  logout: () => studentApi('/api/auth/logout', { method: 'POST' }),
};

export const modules = {
  list: () => studentApi('/api/modules', { method: 'GET' }),

  playbackToken: (moduleId: string) =>
    studentApi(`/api/modules/${encodeURIComponent(moduleId)}/token`, { method: 'GET' }),
};
```

---

## 6. Route → API mapping (student SPA)

| SPA route | Typical API calls |
|-----------|-------------------|
| `/register` | `POST /api/auth/register` |
| `/sign-in` | `POST /api/auth/login` |
| `/activate` | `GET /api/auth/token-check?…` then `POST /api/auth/activate` |
| `/forgot-password` | `POST /api/auth/forgot-password` |
| `/reset-password` | `GET /api/auth/token-check?type=reset&…` then `POST /api/auth/reset-password` |
| `/dashboard` | `GET /api/modules` (after session established) |
| `/dashboard/module/:id` | `GET /api/modules`, `GET /api/modules/:id/token` (list can be cached) |

**Session awareness:** There is **no** `GET /api/auth/me` in this API. After login/activate/reset, use returned **`data`** for `{ id, full_name, email }`, or call **`GET /api/modules`** (401 = not logged in).

---

## 7. Security reminders for the frontend

- Never send **`SUPABASE_SERVICE_ROLE_KEY`**, **`JWT_STUDENT_SECRET`**, or **`CF_STREAM_API_TOKEN`** from the browser — they are server-only.
- Do not log full **reset/activation URLs** (they contain secrets) in analytics.
- **Forgot password:** always show the **same** success UI for any email submission.

---

## 8. Support

- **Contract:** `/api/docs` on the deployed API.  
- **Backend repo:** `README.md` (CORS, env, Supabase, production checklist).

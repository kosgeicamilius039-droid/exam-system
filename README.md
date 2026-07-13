# ExamSystem — GitHub Pages + Supabase only

No Render. No Express. No server to manage.

```
GitHub Pages  →  frontend (5 HTML files)
Supabase      →  database (PostgreSQL) + auth + Edge Function
```

---

## Stack overview

| Concern | Solution |
|---|---|
| Hosting | GitHub Pages (free, forever) |
| Database | Supabase PostgreSQL (free tier, persistent) |
| Auth | Supabase Auth (JWT, built-in) |
| Create accounts | Supabase Edge Function (`create-user`) |
| Row-level security | Supabase RLS policies |

Accounts are stored as `username@examsystem.local` in Supabase Auth
internally. Users only ever see a plain "Username" field — the email
conversion happens invisibly in the login page.

---

## 1. Supabase — run the SQL

1. Open your Supabase project → **SQL Editor** → **New query**
2. Paste the entire contents of `supabase/seed.sql` and click **Run**
3. You should see "Success. No rows returned."

## 2. Create the default admin account

**Step A** — Supabase dashboard → **Authentication → Users → Add user → Create new user**:
- Email: `camillus@examsystem.local`
- Password: `Camillus@Kosgei`
- Tick **Auto Confirm User**
- Click **Create User**

**Step B** — Back in the SQL editor, run this one line:
```sql
INSERT INTO profiles (id, username, role)
SELECT id, 'Camillus', 'admin'
FROM auth.users
WHERE email = 'camillus@examsystem.local'
ON CONFLICT (id) DO NOTHING;
```

## 3. Deploy the Edge Function

The `create-user` Edge Function lets admins create new accounts from
inside the app. You deploy it once using the Supabase CLI.

### Install the CLI (PowerShell)
```powershell
npm install -g supabase
```

### Login and link
```powershell
supabase login
supabase link --project-ref qdrmelyjtufljktudjjr
```
(Use your actual project ref — the part between `https://` and `.supabase.co`)

### Deploy
```powershell
supabase functions deploy create-user --no-verify-jwt
```

> `--no-verify-jwt` lets the function verify the token itself using the
> anon key (which is what the code does) rather than having the gateway
> block the request before it even reaches the function.

Once deployed, the function is live at:
```
https://qdrmelyjtufljktudjjr.supabase.co/functions/v1/create-user
```

## 4. Push to GitHub and enable GitHub Pages

The frontend `config.js` already has your Supabase URL and key — nothing
to change there.

```powershell
cd D:\exam-system
git add .
git commit -m "Migrate to Supabase + GitHub Pages only stack"
git push
```

Then on GitHub: **Settings → Pages → Source → GitHub Actions**.

Your site goes live at:
```
https://novestusrono.github.io/Exam-System/index.html
```

## 5. Allow GitHub Pages origin in Supabase

Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://novestusrono.github.io`
- **Redirect URLs**: add `https://novestusrono.github.io/*`

This tells Supabase Auth to accept token redirects from your Pages URL.

---

## How accounts work

- Only **admins** can create accounts — via the **Manage Users** page
  inside the app, which calls the `create-user` Edge Function.
- New accounts are created with a **username** and a **password** (min 10
  chars). The admin also chooses the role: `teacher` or `admin`.
- Internally, Supabase stores users as `username@examsystem.local` — the
  login page converts username → email before calling Supabase Auth.
- The `profiles` table stores the username, role, and creation date and
  is linked 1:1 to `auth.users`.

## Roles

| Role | Can do |
|---|---|
| **admin** | login, manage users (create + list), view audit log, change own password |
| **teacher** | login, view grades, add students, edit grades, change own password |

Row Level Security enforces these rules at the database level — a teacher
who tried to call the Supabase API directly for the audit log would get
an empty result set, not an error, but they can't see the data.

## Adding more admin accounts

Log in as Camillus → **Audit Dashboard → Manage Users → Create New Account** →
set role to `Admin`.

## Resetting a user's password

Currently handled by the user themselves via the **Change password**
button on their dashboard. Admins can also reset via
Supabase dashboard → **Authentication → Users → [user] → Send password reset**.

---

## Local development

For local testing, open `frontend/` with any static file server:

```powershell
cd D:\exam-system\frontend
python3 -m http.server 5500
```

Then visit `http://localhost:5500/index.html`. The frontend talks directly
to your live Supabase project (since the Supabase URL and key are in
`config.js`), so no local backend setup is needed at all.

To allow `localhost:5500` as an auth origin during development:
Supabase → **Authentication → URL Configuration → Redirect URLs** →
add `http://localhost:5500/*`.

# Web Deployment

This is the minimum web deployment needed before App Store submission.

## Target URLs

Use `ai-divination.com` as the platform domain and `oraya.ai-divination.com`
as the Oraya product domain.

```text
https://oraya.ai-divination.com/privacy
https://oraya.ai-divination.com/terms
https://oraya.ai-divination.com/support
https://oraya.ai-divination.com/dashboard
```

The first three URLs must be public. `/dashboard` is the private admin entry.

## Vercel Project

Create one Vercel project for the Next.js admin web app.

Recommended settings:

```text
Framework Preset: Next.js
Root Directory: admin-web
Build Command: npm run build
Install Command: npm install
Output Directory: .next
```

Environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=https://lckhqitjvnszcojppnnh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon/publishable key>
NEXT_PUBLIC_ADMIN_BASE_URL=https://oraya.ai-divination.com
```

Do not add service role keys to Vercel for this web app.

## Domain Setup

In Vercel, add this domain to the project:

```text
oraya.ai-divination.com
```

Then add the DNS record at the domain provider:

```text
Type:  CNAME
Name:  oraya
Value: cname.vercel-dns.com
```

If Vercel shows a different project-specific CNAME target, use the value shown
by Vercel.

## Supabase Auth URLs

In Supabase Dashboard, update:

```text
Authentication > URL Configuration > Site URL
https://oraya.ai-divination.com
```

Add redirect URLs:

```text
https://cosmic-daily-app.vercel.app/auth
https://cosmic-daily-app.vercel.app/dashboard
https://oraya.ai-divination.com/auth
https://oraya.ai-divination.com/dashboard
https://<vercel-project>.vercel.app/auth
https://<vercel-project>.vercel.app/dashboard
http://127.0.0.1:3000/auth
http://127.0.0.1:3000/dashboard
```

The admin web login redirects to `/dashboard` after Google auth.
If testing before the custom domain is live, replace `<vercel-project>` with the
temporary Vercel deployment hostname shown by Vercel.

## Google OAuth

In Google Cloud OAuth client settings, keep the Supabase callback URL as the
authorized redirect URI:

```text
https://lckhqitjvnszcojppnnh.supabase.co/auth/v1/callback
```

Do not replace it with the Vercel domain. Supabase receives the Google OAuth
callback, then sends the user back to the app URL allowed above.

## App Store URLs

Use these in App Store Connect:

```text
Privacy Policy URL: https://oraya.ai-divination.com/privacy
Terms URL:          https://oraya.ai-divination.com/terms
Support URL:        https://oraya.ai-divination.com/support
```

Before public launch, confirm `support@ai-divination.com` is active and receives
test email.

# Instagram DM Capture Setup Guide

This guide walks you through setting up the Instagram DM capture feature for Spot.

## Prerequisites

1. A Facebook Developer account
2. A Facebook Page (required for Instagram Business API)
3. An Instagram Business or Creator account linked to that Page

## Step 1: Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new App → Select "Business" type
3. Add these products to your app:
   - **Instagram Graph API**
   - **Messenger** (for Instagram messaging)

## Step 2: Configure Instagram Basic Display

1. In your app dashboard, go to **Instagram Basic Display** → **Basic Display**
2. Add your OAuth redirect URI:
   ```
   https://spot-ai-3.vercel.app/api/instagram/auth
   ```
3. Note your **Instagram App ID** and **Instagram App Secret**

## Step 3: Connect Your Facebook Page

1. Go to **Messenger** → **Instagram Settings**
2. Connect your Facebook Page to the app
3. Make sure your Instagram Business account is linked to this Page

## Step 4: Set Up Webhooks

1. Go to **Webhooks** in your app dashboard
2. Subscribe to the **Instagram** product:
   - Callback URL: `https://spot-ai-3.vercel.app/api/instagram/webhook`
   - Verify Token: Use a secure random string (save it for env vars)
   - Subscribe to: `messages`, `messaging_postbacks`

## Step 5: Get Page Access Token

1. Go to **Access Tokens** in your app
2. Generate a Page Access Token for your connected Page
3. Exchange it for a long-lived token (60 days):
   ```bash
   curl -X GET "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_LIVED_TOKEN}"
   ```

## Step 6: Environment Variables

Add these environment variables to your Vercel project:

```env
# Instagram/Facebook App Credentials
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret

# OAuth Redirect URI (your deployed app URL)
INSTAGRAM_REDIRECT_URI=https://spot-ai-3.vercel.app/api/instagram/auth

# Webhook Verification Token (a secret string you choose)
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=your_verify_token

# Long-lived Page Access Token (for sending DM replies)
INSTAGRAM_PAGE_ACCESS_TOKEN=your_long_lived_page_token
```

## Step 7: Apply Database Migration

Run the Supabase migration to create the required tables:

```bash
supabase db push
```

Or apply manually:
```sql
-- See: supabase/migrations/20251210_instagram_dm_capture.sql
```

## Step 8: Test the Integration

### Verify Webhook
1. Meta will send a verification request to your webhook
2. Check Vercel logs to confirm: `[Webhook] Verification successful`

### Test DM Flow
1. Link your Instagram account in the Spot app (Profile → Instagram Integration)
2. Send a DM to your Spot Instagram account with an Instagram post/Reel URL
3. Check that:
   - Webhook receives the message
   - Place is saved to your list
   - You receive a confirmation DM

## Permissions Required for App Review

When submitting for App Review, request these permissions:
- `instagram_basic` - Read user profile
- `instagram_manage_messages` - Send and receive DMs
- `pages_messaging` - Required for Instagram Messaging API

## Troubleshooting

### Webhook Not Receiving Messages
- Verify webhook subscription is active in Meta dashboard
- Check that verify token matches
- Ensure HTTPS is working correctly

### oEmbed Failing
- Instagram oEmbed only works for public posts
- Private accounts or age-gated content will fail

### Token Expired
- Long-lived tokens last 60 days
- Set up a cron job to refresh tokens before expiry:
  ```
  GET /oauth/access_token?grant_type=fb_exchange_token&...
  ```

## Rate Limits

- Instagram Messaging API: ~200 messages per hour
- oEmbed API: ~200 requests per hour
- Respect the 24-hour messaging window for DMs

## Security Notes

1. **Never expose** your App Secret or Page Access Token
2. Store tokens encrypted in production
3. Validate webhook signatures in production (see Meta docs)
4. Implement rate limiting to prevent abuse

## Files Created

- `api/instagram/auth.ts` - OAuth flow for linking accounts
- `api/instagram/webhook.ts` - Webhook handler for incoming DMs
- `supabase/migrations/20251210_instagram_dm_capture.sql` - Database tables
- `src/lib/api.ts` - Frontend API client (instagramApi)
- `src/components/UserProfileSheet.tsx` - Instagram linking UI


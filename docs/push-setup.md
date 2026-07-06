# Push notifications — going live

The server-side push pipeline is **deployed and wired but dormant**. Postgres
triggers on `activity_events` and `messages` call the `push` edge function
(via `pg_net`), which sends APNs alert notifications to each recipient's iOS
`push_tokens`. Until an APNs Auth Key is provided, the function logs
`APNs not configured, skipping` and returns `200` without sending.

## Architecture

```
insert activity_events / messages
        │  AFTER INSERT trigger  (public.notify_push)
        ▼
  net.http_post  ──x-push-secret──►  edge function  supabase/functions/push
        (pg_net, async)                     │
                                            ├─ resolve recipients (service role)
                                            ├─ look up iOS push_tokens
                                            └─ APNs HTTP/2 (ES256 JWT)  ──► device
```

- **Webhook auth:** the trigger reads `push_webhook_secret` from Supabase Vault
  and sends it as the `x-push-secret` header. The function rejects any request
  whose header does not match its `PUSH_WEBHOOK_SECRET` function secret with
  `401`. Both are already provisioned.
- **Recipients:**
  - `activity` → `record.user_id` (skipped when `actor_id == user_id`).
  - `message` → all `message_thread_participants` of the thread minus the sender.
- **Dead-token cleanup:** APNs `410 Unregistered` deletes that `push_tokens` row.
- **Dev vs prod gateway:** the function posts to `api.push.apple.com` first and
  retries once on `api.sandbox.push.apple.com` when APNs replies
  `400 BadDeviceToken`, so debug-build tokens still deliver.

## Step 1 — create an APNs Auth Key (.p8)

1. Apple Developer portal → **Certificates, Identifiers & Profiles → Keys → +**.
2. Name it (e.g. `plus1 APNs`), enable **Apple Push Notifications service (APNs)**,
   Continue → Register.
3. **Download** the `AuthKey_XXXXXXXXXX.p8` (you can only download it once).
4. Note the **Key ID** (the `XXXXXXXXXX` in the filename) and your **Team ID**
   (`PNQXU683AK`, top-right of the portal).

## Step 2 — set the APNs function secrets

From the repo root, with the `.p8` file present:

```bash
supabase secrets set \
  APNS_KEY_P8="$(cat AuthKey_XXXXXXXXXX.p8)" \
  APNS_KEY_ID=XXXXXXXXXX \
  APNS_TEAM_ID=PNQXU683AK \
  APNS_TOPIC=com.allenliao.Plus1 \
  --project-ref qjuiqeclnrvkyjnqltxq
```

- `APNS_TOPIC` is the iOS app bundle id (`com.allenliao.Plus1`).
- Setting `APNS_KEY_P8` + `APNS_KEY_ID` flips the pipeline from dormant to live —
  no redeploy needed (edge functions pick up secret changes on the next invoke).
- The `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` the function uses to resolve
  recipients are injected automatically; you do not set them.

Delete the local `.p8` afterward — the key now lives only in function secrets.

## Step 3 — test

Insert an activity row **for your own user** (so it targets a real device) with a
**different** `actor_id` (self-authored rows are intentionally skipped), then
watch the function logs:

```bash
# Two real profile ids: RECIPIENT (you) and ACTOR (anyone else).
supabase functions logs push --project-ref qjuiqeclnrvkyjnqltxq
```

In the SQL editor:

```sql
insert into activity_events (user_id, actor_id, type, title)
values ('<your-profile-id>', '<other-profile-id>', 'test', 'push test');
```

Expected once APNs is configured: a `plus1` notification on your device and a
`"status":"sent"` line in the logs. While dormant you will see
`APNs not configured, skipping` and `"status":"dormant"`.

You can also confirm the trigger delivered to the function without the app by
reading pg_net's response log (Management API / SQL editor):

```sql
select status_code, content
from net._http_response
order by created desc
limit 5;
```

## iOS payload contract

The APNs payload custom keys are **exactly** these strings, both string-typed:

| Key        | Present when                        | Value               |
|------------|-------------------------------------|---------------------|
| `questId`  | activity row has a `quest_id`       | the quest UUID      |
| `threadId` | every message notification          | the thread UUID     |

Standard alert fields: `aps.alert.title`, `aps.alert.body`, `aps.sound`, and
`aps.thread-id` (set to the quest/thread id for notification coalescing). Titles
are `"plus1"` for activity and `"<Sender> · <Event title or Message>"` for
messages; message bodies are truncated to ~120 characters.

## Redeploying the function

```bash
supabase functions deploy push --project-ref qjuiqeclnrvkyjnqltxq --no-verify-jwt --use-api
```

`--no-verify-jwt` is required (also pinned in `supabase/config.toml`): the caller
is Postgres via pg_net, authenticated by `x-push-secret`, not an end-user JWT.

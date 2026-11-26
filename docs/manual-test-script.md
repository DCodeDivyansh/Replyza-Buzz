# Replyza Manual Real-Account QA Script

Use this script after deploying to staging or enabling the ManyChat engine flags for a test Instagram Business account. Never run automated tests against real Instagram accounts.

## Prerequisites
1. A Meta App in **Live** or **Development** mode with test users/testers configured.
2. Required permissions approved / tester-enabled:
   - `instagram_basic`
   - `instagram_manage_comments`
   - `instagram_manage_messages`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
3. An Instagram Business (or Creator) account linked to a Facebook Page, plus a second personal Instagram test account (the commenter).

---

## Test 1 — Connect Instagram & Verify Webhook Subscription
1. Log into `https://replyza.buzz` -> go to **Instagram Accounts**.
2. Click **Connect Instagram Account** (Facebook Login for Business `config_id` flow).
3. Complete OAuth and select the test Page + IG Business account.
4. **Expected**:
   - Account shows status `ACTIVE` and `webhookSubscribed: true`.
   - In Meta App Dashboard -> Webhooks, verify `comments`, `messages`, and `messaging_postbacks` are subscribed.

## Test 2 — All Posts & Reels Automation + Public Reply Variations
1. Go to **Automations** -> **New Automation**.
2. Select **All Posts & Reels** (`mediaId = null`), trigger **Keyword**, match mode **Contains**, keyword `GUIDE`.
3. Add 3 public reply variations (e.g., `"Check your DMs!"`, `"Sent it over 📩"`, `"Just DM'd you!"`).
4. Set Delivery Mode **Button Hook** (`"Send me the guide"`), **Follow Gate: OFF**, DM text + link `https://replyza.buzz`.
5. Activate the automation.
6. From the second IG account, comment `Can I get the GUIDE please?` on any Reel.
7. **Expected**:
   - Within a few seconds, a public reply appears on the comment (rotating across variations on subsequent comments).
   - A Private Reply DM arrives with the Quick Reply button `"Send me the guide"`.
   - Tap the button -> instant DM with `https://replyza.buzz` arrives (no follow check).

## Test 3 — Post-Specific Override & Follow Gate ON
1. Create a second automation pinned to a specific post, trigger **Keyword** `VIP`, **Follow Gate: ON**, custom `followInstructionText`, `followSuccessText`, `followFallbackText`.
2. Ensure the commenter test account does **NOT** follow the business account.
3. Comment `VIP!` on that specific post.
4. **Expected**:
   - Post-specific automation wins over All Posts & Reels.
   - Hook DM arrives with `"I've followed! ✅"` Quick Reply.
   - Tap `"I've followed! ✅"` while NOT following -> receives `followFallbackText` + retry button (max 3 retries).
   - Follow the business account, tap `"I've followed! ✅"` again -> receives `followSuccessText` + reward link.

## Test 4 — Desktop Text Fallback & DM-Me Fallback
1. Comment `VIP` from a browser/desktop session (or simulate not tapping the Quick Reply button) and reply `YES` or `DONE` in the DM thread.
   - **Expected**: Treated as consent and triggers follow check / reward delivery.
2. Enable **DM-Me Fallback** on an automation with keyword `GUIDE`. Send a direct DM `GUIDE` from the test account.
   - **Expected**: Automation matches inbound DM and delivers the reward DM.

## Test 5 — Activity & Execution Timeline
1. Open **Activity** in the Replyza dashboard.
2. Click any execution row to open the Timeline modal.
3. **Expected**:
   - Shows `conversationState` (e.g., `COMPLETED`) and individual `deliveryActions` rows (`PUBLIC_REPLY`, `HOOK_DM`, `LINK_DM`) with attempt counts and Meta IDs.
   - Platform rules banner clearly explains Meta's 1 Private Reply per comment / 7-day / 24-hour messaging window rules.

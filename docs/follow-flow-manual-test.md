# Follow-Verification & Product-Link Manual Test Script (Real Instagram)

Use this script to verify live Meta Instagram Platform behavior after deploying `fix/follow-verification` to staging. Do **not** run automated tests against real Instagram accounts.

> **Meta App Mode & Permissions Note:**
> - In Meta **Development Mode**, only users with an assigned **App Role** (Admin, Developer, Tester, or Instagram Tester) can trigger webhooks and receive automated DMs.
> - Reading `is_user_follow_business` reliably in production requires **Advanced Access** for `instagram_manage_messages` (plus `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`) via Meta App Review.
> - Some users restrict follow-status visibility; Meta omits `is_user_follow_business` for those users, so Replyza treats them as `UNSUPPORTED` / `UNKNOWN` and sends a neutral retry message rather than falsely claiming they are not following.

---

## Prerequisites
1. Connected Instagram Business account (`ACTIVE`, `webhookSubscribed: true`) with `comments`, `messages`, `messaging_postbacks` subscribed.
2. An active automation with:
   - `followRequired: true`
   - `dmLink`: e.g. `https://replyza.buzz/test-product`
   - `followInstructionText`, `followSuccessText`, `followFallbackText` configured
3. Two personal Instagram test accounts (Account X = follows business; Account Y = does NOT follow business; optionally Account Z = private/restricted profile).

---

## Test Cases

### 1. Comment on Reel -> Initial DM
1. From Account X, comment the trigger keyword on the target Reel.
2. **Expected**:
   - Public reply appears on the comment.
   - Private Reply DM arrives containing your `followInstructionText`, the `"I've followed! ✅"` quick-reply button (mobile), and the text fallback instruction (`"reply FOLLOWED once you've followed"`).

### 2. Tap Quick-Reply Button While Following (Mobile)
1. On mobile Instagram with Account X (already following), tap `"I've followed! ✅"`.
2. **Expected**:
   - Follow verification succeeds (`VERIFIED`).
   - Product link DM arrives **once**.
   - Activity log shows **Verified · Link sent** and status **Completed**.

### 3. Type `"I've followed"` From Desktop While Following
1. Comment again from Account X (or another following test account) on desktop Instagram Web (`instagram.com`), where quick-reply buttons may not render.
2. Type `I've followed` (or `done` / `🙏`) in the DM thread.
3. **Expected**:
   - Treated as consent, triggers follow check, verifies `is_user_follow_business === true`, and sends the product link DM **once**.

### 4. Tap / Type While NOT Following -> Retry After Following
1. Comment from Account Y (does NOT follow the business account).
2. Tap `"I've followed! ✅"` or type `I've followed`.
3. **Expected**:
   - No product link is sent.
   - Receives `followFallbackText` with a retry button and text hint.
   - Activity log shows **Not following**.
4. Now follow the business account from Account Y, then tap `"I've followed! ✅"` (or type `followed`).
5. **Expected**:
   - Verification succeeds (`VERIFIED`) and product link DM is delivered **once**.

### 5. Private / Restricted Account (`is_user_follow_business` Omitted)
1. Comment from Account Z (privacy-restricted or unsupported access level) and reply `I've followed`.
2. **Expected**:
   - No product link is sent.
   - Receives neutral message: `"I couldn't verify right now, please try again in a minute."`
   - Activity log shows **Couldn't verify (unsupported)** with diagnostic reason — never `"Not following"`.

### 6. Broken / Revoked Token (Error 190)
1. Revoke the page/IG token (or test with an invalidated token in staging).
2. Trigger a follow check.
3. **Expected**:
   - Account status transitions to `NEEDS_RECONNECT`.
   - No retries burned; dashboard shows reconnect banner.

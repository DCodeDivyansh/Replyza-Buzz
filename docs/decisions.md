# Replyza — Architecture & Product Decisions (`docs/decisions.md`)

1. **Feature Branch & Commit Strategy**: All ManyChat-style engine rebuild work is isolated on `feat/manychat-engine` with small, logical commits. No production deployments or pushes are performed.
2. **Feature Flags**: New capabilities (`MANYCHAT_ENGINE`, `INDEPENDENT_ACTIONS`, `FOLLOW_CHECK_SIGNED_TOKENS`, `DM_ME_FALLBACK`) are gated behind environment-driven flags that default to `OFF` in `NODE_ENV=production` and `ON` in `development`/`test` for safe progressive rollout.
3. **Graph API Version**: Removed silent `v21.0` fallback in `MetaGraphClient` when running outside test/explicit config; `META_GRAPH_API_VERSION` is read from environment variables and validated at startup.
4. **Two-Step ManyChat Conversation Model**:
   - Each automation supports `deliveryMode`: `DIRECT` (link sent in first private reply) or `BUTTON` (two-step hook DM with Quick Reply button + text fallback). `followRequired = true` always implies `BUTTON`.
   - Because Meta Quick Replies only render on mobile Instagram apps, hook and fallback DMs include a concise text fallback (e.g., `"Reply LINK to get it"`), and **any** inbound user DM inside an active `AWAITING_TAP` / `AWAITING_FOLLOW` conversation is treated as consent to run the follow check or deliver the link.
5. **Signed Quick Reply Payloads**: `FOLLOW_CHECK` payloads use HMAC-SHA256 (`FOLLOW_CHECK:<executionId>.<sig>`) verified with `timingSafeEqual`, plus sender IGSID, receiving account, and execution state checks.
6. **All-Media Automations & Precedence**: `Automation.mediaId` is nullable (`NULL` = all posts/Reels). Partial unique indexes enforce at most one automation per `(instagramAccountId, mediaId)` when `mediaId IS NOT NULL` and at most one `ACTIVE` all-media automation per `instagramAccountId` when `mediaId IS NULL`. Precedence: media-specific > all-media > oldest `ACTIVE` (`createdAt ASC`) wins; only one fires per comment.
7. **Independent Delivery Actions**: `PUBLIC_REPLY`, `HOOK_DM`, `LINK_DM`, and `FOLLOW_FALLBACK_DM` are tracked in `delivery_actions` with atomic `UPDATE ... WHERE status='PENDING' RETURNING *` claims. `PUBLIC_REPLY` and `HOOK_DM` dispatch as separate BullMQ jobs (`${executionId}:PUBLIC_REPLY` and `${executionId}:HOOK_DM`) so one failing channel never blocks the other.
8. **Exactly-Once & `NEEDS_REVIEW` Semantics**: Private reply `"already has a private reply"` (`DUPLICATE_ACTION`) is treated as `SENT`-equivalent. Public reply `DUPLICATE_ACTION` is marked `FAILED` non-retryable unless `GET /{commentId}/replies` confirms our reply is already posted. Timed-out or crashed `SENDING` actions that cannot be reconciled via Meta API are marked `NEEDS_REVIEW` (never blindly resent).
9. **Honest Follow Verification**: Omitted `is_user_follow_business` or API errors retry once cleanly, then send a neutral message and mark `UNKNOWN`/`UNSUPPORTED` — never treated as `NOT_FOLLOWING` and never falsely marked `VERIFIED`.
10. **ManyChat Features Meta Does Not Permit (Gap List)**:
    - Checking follower status *at comment time* before the user interacts in DM (Meta requires messaging consent first).
    - Sending multiple unsolicited private replies to the same comment (Meta limits to 1 private reply per comment within 7 days).
    - Sending promotional/link DMs after the 24-hour messaging window closes without a new user message.
    - Rendering interactive Quick Reply buttons on Instagram desktop web (mobile-only in Meta's client).

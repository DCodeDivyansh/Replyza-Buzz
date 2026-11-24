# Meta Graph API Integration Guide

## 1. Overview & Architecture

Replyza interacts with Meta's Graph API (`v21.0`) to ingest Instagram comments, send public replies, deliver private direct messages, verify follower status, and fetch media assets.

To guarantee zero token leakage, unified retry behavior, and strict error classification, all HTTP interactions with Meta are centralized in the `MetaGraphClient` (`packages/shared/src/meta-graph-client.ts`).

---

## 2. Centralized Client: `MetaGraphClient`

### Features
- **Configurable Base URL & Version**: Defaults to `https://graph.facebook.com/v21.0`. Supports custom mock servers for automated testing (`META_GRAPH_BASE_URL`).
- **Cryptographic Token Redaction**: URLs, query parameters (`access_token`), request headers, and error bodies are sanitized before logging.
- **Exponential Backoff with Jitter**: Automatically retries transient 5xx server errors and transient 429 rate limit errors with exponential delay ($delay = base \times 2^{attempt} + jitter$).
- **Fail-Fast Policy**: Client errors (400, 401, 403, 404) and non-retryable Meta subcodes fail immediately without consuming queue resources.
- **Strict Timeouts**: Enforces request timeouts via `AbortController` (default 10,000ms).

---

## 3. Meta Error Categorization

Every Meta error is classified into an actionable category:

| Category | HTTP / Meta Codes | System Behavior |
| :--- | :--- | :--- |
| `TOKEN_EXPIRED` | Code `190` | Marks `InstagramAccount.status = 'NEEDS_RECONNECT'`. Aborts retry. Notifies user via UI banner. |
| `RATE_LIMITED` | Code `4` or `17` | Marks `InstagramAccount.status = 'RATE_LIMITED'`. Delays BullMQ job with exponential backoff. |
| `CAPABILITY_RESTRICTED` | Code `10` or `200-299` | App permissions revoked or business account disconnected. Marks execution `FAILED`. |
| `RESOURCE_NOT_FOUND` | Code `100` / HTTP 404 | Comment or media deleted on Instagram. Marks execution `FAILED` (permanent). |
| `UPSTREAM_TEMPORARY` | HTTP 500, 502, 503, 504 | Retries via BullMQ up to 3 attempts. |
| `UNKNOWN_OUTCOME` | Network timeout / drop | Action marked `UNKNOWN`; re-checked before re-executing to prevent duplicate DMs. |

---

## 4. Required Meta Permissions & App Review

To operate the full Comment-to-DM and Follow-to-Get-Link workflows in production, the Meta Developer App requires the following permissions:

| Permission | Purpose | App Review Required? |
| :--- | :--- | :--- |
| `instagram_basic` | Read profile info, media list, and account ID | Yes (for public users) |
| `instagram_manage_comments` | Read comments webhook, post public replies | Yes |
| `instagram_manage_messages` | Send private replies to comments, send direct messages, handle quick replies | Yes |
| `pages_show_list` | Discover linked Facebook Pages | Yes |
| `pages_read_engagement` | Read Facebook page connection metadata | Yes |
| `business_management` | Facebook Login for Business flow | Yes |

---

## 5. Endpoints & Execution Mapping

### 5.1 Media Fetching
- **Endpoint**: `GET /{instagram-user-id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp`
- **Doc**: [Meta Instagram Media API](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media)

### 5.2 Public Comment Reply
- **Endpoint**: `POST /{comment-id}/replies`
- **Body**: `message=<interpolated_text>`
- **Response**: `{ "id": "<meta_reply_id>" }`
- **Doc**: [Meta Comments Moderation](https://developers.facebook.com/documentation/instagram-platform/comment-moderation)

### 5.3 Private Reply (Comment to DM)
- **Endpoint**: `POST /{instagram-user-id}/messages`
- **Body**: 
  ```json
  {
    "recipient": { "comment_id": "<comment_id>" },
    "message": { "text": "<text>" }
  }
  ```
- **Response**: `{ "message_id": "<mid>" }`
- **Doc**: [Meta Private Replies](https://developers.facebook.com/documentation/instagram-platform/messaging)
- **Constraint**: Exactly **one** private reply per comment allowed by Meta within 7 days.

### 5.4 Private Reply with Quick Reply (Follow-Gated Step 1)
- **Endpoint**: `POST /{instagram-user-id}/messages`
- **Body**:
  ```json
  {
    "recipient": { "comment_id": "<comment_id>" },
    "message": {
      "text": "<instruction_text>",
      "quick_replies": [
        {
          "content_type": "text",
          "title": "I've followed! ✅",
          "payload": "FOLLOW_CHECK:<execution_id>"
        }
      ]
    }
  }
  ```

### 5.5 Follower Verification (Follow-Gated Step 2)
- **Endpoint**: `GET /{igsid}?fields=is_user_follow_business,name,username`
- **Doc**: [Meta Instagram User Profile API](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-user)
- **Field**: `is_user_follow_business: boolean`

### 5.6 Link Delivery / Retry DM (Follow-Gated Step 3)
- **Endpoint**: `POST /{instagram-user-id}/messages`
- **Body**:
  ```json
  {
    "recipient": { "id": "<igsid>" },
    "message": { "text": "<delivery_text_with_link>" }
  }
  ```
- **Doc**: [Meta Send Message API](https://developers.facebook.com/documentation/instagram-platform/messaging)

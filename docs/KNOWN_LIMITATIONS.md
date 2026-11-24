# Meta Graph API Constraints & Known Limitations

## 1. Meta Instagram Platform Inherent Constraints

Replyza operates strictly within official Meta Graph API specifications. Any behavior not permitted by Meta cannot be implemented without risking account suspension.

### 1.1 One Private Reply Per Comment
- **Rule**: Meta allows a business account to send exactly **one** private direct message per incoming comment.
- **Documentation**: [Meta Private Replies Documentation](https://developers.facebook.com/documentation/instagram-platform/messaging)
- **Time Window**: Private replies must be sent within **7 days** of the comment being posted.
- **Handling in Replyza**: 
  - Replyza marks the execution's `privateReplyStatus` once sent.
  - Subsequent comment edits or webhook re-deliveries do not attempt another private reply.

### 1.2 24-Hour Messaging Window
- **Rule**: Once a private reply is sent, the user must interact with the business (e.g. click a Quick Reply button or send a DM) to open the standard 24-hour messaging window.
- **Follow-to-Get-Link Handling**: The initial private message sends a Quick Reply button (`"I've followed! ✅"`). When the user taps the button, an incoming messaging event is triggered, opening the messaging window and enabling the automated delivery of the link.

### 1.3 Follower Status Verification Scope
- **Rule**: The field `is_user_follow_business` on the user profile endpoint (`GET /{igsid}?fields=is_user_follow_business`) is only available for users who have messaged or interacted with the business account via the Instagram Messaging API.
- **Constraint**: Replyza cannot check whether a user follows the account from a comment alone until the user has clicked the Quick Reply button in their DM thread.

### 1.4 Rate Limits
- **Meta Graph API Rate Limit**: 200 calls per hour per connected user account for business management.
- **Handling**: Replyza's `MetaGraphClient` automatically detects error code `4` and `17`, categorizes them as `RATE_LIMITED`, and pauses the worker queue with exponential backoff.

### 1.5 Media Types Support
- **Supported**: Instagram Posts (`IMAGE`), Carousels (`CAROUSEL_ALBUM`), and Reels (`VIDEO`).
- **Limitation**: Instagram Stories comments and ephemeral live stream comments are not supported by the comment webhook endpoint.

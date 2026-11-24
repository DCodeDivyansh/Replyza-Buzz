const isProduction = process.env.NODE_ENV === "production";

function flag(envName: string): boolean {
  const val = process.env[envName];
  if (isProduction) {
    return val === "true";
  }
  return val !== "false";
}

export const features = {
  MEDIA_LIBRARY: flag("ENABLE_MEDIA_LIBRARY"),
  FOLLOW_TO_GET_LINK: flag("ENABLE_FOLLOW_GATE"),
  TEMPLATES: flag("ENABLE_TEMPLATES"),
  NEW_BUILDER: flag("ENABLE_NEW_BUILDER"),
  MANYCHAT_ENGINE: flag("ENABLE_MANYCHAT_ENGINE"),
  INDEPENDENT_ACTIONS: flag("ENABLE_INDEPENDENT_ACTIONS"),
  FOLLOW_CHECK_SIGNED_TOKENS: flag("ENABLE_FOLLOW_CHECK_SIGNED_TOKENS"),
  DM_ME_FALLBACK: flag("ENABLE_DM_ME_FALLBACK"),
} as const;

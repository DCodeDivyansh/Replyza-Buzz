const isProduction = process.env.NODE_ENV === "production";

function flag(envName: string): boolean {
  const val = process.env[envName];
  if (isProduction) {
    return val === "true";
  }
  return val !== "false";
}

export const features = {
  MEDIA_LIBRARY: flag("NEXT_PUBLIC_ENABLE_MEDIA_LIBRARY"),
  FOLLOW_TO_GET_LINK: flag("NEXT_PUBLIC_ENABLE_FOLLOW_GATE"),
  TEMPLATES: flag("NEXT_PUBLIC_ENABLE_TEMPLATES"),
  NEW_BUILDER: flag("NEXT_PUBLIC_ENABLE_NEW_BUILDER"),
  MANYCHAT_ENGINE: flag("NEXT_PUBLIC_ENABLE_MANYCHAT_ENGINE"),
  DM_ME_FALLBACK: flag("NEXT_PUBLIC_ENABLE_DM_ME_FALLBACK"),
} as const;

export const features = {
  mediaLibrary: process.env.NEXT_PUBLIC_ENABLE_MEDIA_LIBRARY !== "false",
  followToGetLink: process.env.NEXT_PUBLIC_ENABLE_FOLLOW_GATE !== "false",
  templates: process.env.NEXT_PUBLIC_ENABLE_TEMPLATES !== "false",
  newBuilder: process.env.NEXT_PUBLIC_ENABLE_NEW_BUILDER !== "false",
} as const;

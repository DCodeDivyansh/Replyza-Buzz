export const features = {
  MEDIA_LIBRARY: process.env.ENABLE_MEDIA_LIBRARY !== "false",
  FOLLOW_TO_GET_LINK: process.env.ENABLE_FOLLOW_GATE !== "false",
  TEMPLATES: process.env.ENABLE_TEMPLATES !== "false",
  NEW_BUILDER: process.env.ENABLE_NEW_BUILDER !== "false",
} as const;

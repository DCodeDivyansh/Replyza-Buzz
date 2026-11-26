const encryptionKey = process.env.META_TOKEN_ENCRYPTION_KEY;
const graphApiVersion = process.env.META_GRAPH_API_VERSION;
const sessionSecret =
  process.env.SESSION_SECRET || process.env.JWT_SECRET;

if (!encryptionKey || !/^[a-fA-F0-9]{64}$/.test(encryptionKey)) {
  throw new Error("Invalid META_TOKEN_ENCRYPTION_KEY configuration");
}

if (!graphApiVersion || !/^v\d+\.\d+$/.test(graphApiVersion)) {
  throw new Error("Invalid META_GRAPH_API_VERSION configuration");
}

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("Invalid SESSION_SECRET configuration");
}

export const workerEnv = {
  metaTokenEncryptionKey: encryptionKey,
  metaGraphApiVersion: graphApiVersion,
  sessionSecret,
};

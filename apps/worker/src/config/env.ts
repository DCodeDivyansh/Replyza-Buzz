const encryptionKey = process.env.META_TOKEN_ENCRYPTION_KEY;
const graphApiVersion = process.env.META_GRAPH_API_VERSION;

if (!encryptionKey || !/^[a-fA-F0-9]{64}$/.test(encryptionKey)) {
  throw new Error("Invalid META_TOKEN_ENCRYPTION_KEY configuration");
}

if (!graphApiVersion || !/^v\d+\.\d+$/.test(graphApiVersion)) {
  throw new Error("Invalid META_GRAPH_API_VERSION configuration");
}

export const workerEnv = {
  metaTokenEncryptionKey: encryptionKey,
  metaGraphApiVersion: graphApiVersion,
};

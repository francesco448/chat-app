const boolFromEnv = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const numberFromEnv = (value, fallback) => {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const config = {
  uri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017',
  dbName: process.env.MONGO_DB || 'chatapp',
  options: {
    user: process.env.MONGO_USER || undefined,
    pass: process.env.MONGO_PASSWORD || undefined,
    socketTimeoutMS: numberFromEnv(process.env.MONGO_SOCKET_TIMEOUT, 45000),
    connectTimeoutMS: numberFromEnv(process.env.MONGO_CONNECT_TIMEOUT, 30000),
    replicaSet: process.env.MONGO_REPLICA_SET || undefined,
    tls: boolFromEnv(process.env.MONGO_TLS, false),
  },
}

module.exports = config

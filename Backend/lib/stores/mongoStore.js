const config = require('../../config/database')


let MongoClient
try {
  ;({ MongoClient } = require('mongodb'))
} catch (error) {
  MongoClient = null
}


const collectionNames = {
  users: 'users',
  messages: 'messages',
}

function normalizeUser(doc) {
  if (!doc) return null
  const {
    _id,
    username,
    room,
    isOnline,
    joinedAt,
    lastActiveAt,
  } = doc
  return {
    id: _id,
    username,
    room,
    isOnline,
    joinedAt,
    lastActiveAt,
  }
}

function normalizeMessage(doc) {
  if (!doc) return null
  const {
    _id,
    room,
    userId,
    username,
    text,
    createdAt,
  } = doc
  return {
    id: _id,
    room,
    userId,
    username,
    text,
    createdAt,
  }
}

function extractDocument(result) {
  if (!result) return null
  return Object.prototype.hasOwnProperty.call(result, 'value')
    ? result.value
    : result
}

async function createMongoStore() {
  // Guard: fail fast with an actionable message if the driver is missing.
  if (!MongoClient) {
    const message =
      'MongoDB driver is not installed. Run `npm install mongodb` in Backend/.'
    const error = new Error(message)
    error.code = 'MODULE_NOT_INSTALLED'
    throw error
  }

  const client = new MongoClient(config.uri, {
    ...config.options,
    appName: 'chat-app',
  })

  await client.connect()
  const db = client.db(config.dbName)

  const users = db.collection(collectionNames.users)
  const messages = db.collection(collectionNames.messages)

  await Promise.all([
    users.createIndex({ room: 1, isOnline: -1, lastActiveAt: -1 }),
    messages.createIndex({ room: 1, createdAt: 1 }),
  ])

  console.log(
    `Connected to MongoDB at ${
      config.uri
    }/${config.dbName} (collections: ${Object.values(collectionNames).join(', ')})`,
  )

  return {
    async upsertUser({ id, username, room }) {
      const now = new Date()
      const result = await users.findOneAndUpdate(
        { _id: id },
        {
          $set: {
            username: username.trim(),
            room,
            isOnline: true,
            lastActiveAt: now,
            updatedAt: now,
          },
          $setOnInsert: {
            joinedAt: now,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
        },
      )
      const document = extractDocument(result)
      if (document) {
        return normalizeUser(document)
      }


      const inserted = await users.findOne({ _id: id })
      return normalizeUser(inserted)
    },

    async setUserOnline(userId, room) {
      const result = await users.findOneAndUpdate(
        { _id: userId },
        {
          $set: {
            isOnline: true,
            room,
            lastActiveAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      return normalizeUser(extractDocument(result))
    },

    async setUserOffline(userId) {
      const result = await users.findOneAndUpdate(
        { _id: userId },
        {
          $set: {
            isOnline: false,
            lastActiveAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      return normalizeUser(extractDocument(result))
    },

    async updateUsername(userId, username) {
      const result = await users.findOneAndUpdate(
        { _id: userId },
        {
          $set: {
            username: username.trim(),
            lastActiveAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      return normalizeUser(extractDocument(result))
    },

    async removeUser(userId) {
      const result = await users.findOneAndDelete({ _id: userId })
      return normalizeUser(extractDocument(result))
    },

    async getUser(userId) {
      const doc = await users.findOne({ _id: userId })
      return normalizeUser(doc)
    },

    async getParticipants(room) {
      const docs = await users
        .find({ room })
        .sort({ isOnline: -1, lastActiveAt: -1 })
        .toArray()
      return docs.map(normalizeUser)
    },

    async addMessage({ id, room, userId, username, text }) {
      const message = {
        _id: id,
        room,
        userId,
        username,
        text,
        createdAt: new Date(),
      }
      await messages.insertOne(message)
      return normalizeMessage(message)
    },

    async getMessages(room, limit = 100) {
      const docs = await messages
        .find({ room })
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray()
      return docs.map(normalizeMessage)
    },

    async disconnect() {
      await client.close()
    },
  }
}

module.exports = createMongoStore

const path = require('path')
const JsonStore = require('./stores/jsonStore')

async function createDataStore() {
  const requestedStore = process.env.DATA_STORE
  const forceJson = requestedStore === 'json'
  const strictMongo = requestedStore === 'mongo'

  if (forceJson) {
    const filePath = path.join(__dirname, '..', 'data', 'db.json')
    console.log(`Using JSON fallback store at ${filePath}`)
    return new JsonStore(filePath)
  }

  try {
    const createMongoStore = require('./stores/mongoStore')
    return await createMongoStore()
  } catch (error) {
    if (strictMongo) {
      throw error
    }

    console.warn(
      'MongoDB store unavailable, falling back to JSON store.',
      error.message,
    )
  }

  const filePath = path.join(__dirname, '..', 'data', 'db.json')
  console.log(`Using JSON fallback store at ${filePath}`)
  return new JsonStore(filePath)
}

module.exports = createDataStore

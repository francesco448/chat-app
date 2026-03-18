const http = require('http')
const express = require('express')
const config = require('./config')
const createDataStore = require('./lib/datastore')
const createRealtimeServer = require('./lib/simpleWebSocket')
const createCorsMiddleware = require('./middleware/cors')
const createRoomsRouter = require('./routes/rooms')

const app = express()
const server = http.createServer(app)

app.use(express.json())
app.use(createCorsMiddleware(config.clientOrigin))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

async function bootstrap() {
  try {
    const database = await createDataStore()
    const io = createRealtimeServer(server, {
      clientOrigin: config.clientOrigin,
      database,
      onError: (message, error) => console.error(message, error),
    })

    app.use('/rooms', createRoomsRouter({ database, io }))

    app.use((error, _req, res, _next) => {
      console.error('Request failed', error)
      res.status(500).json({ error: 'Internal server error' })
    })

    server.listen(config.port, () => {
      console.log(`Chat backend running on http://localhost:${config.port}`)
    })
  } catch (error) {
    console.error('Unable to start server:', error)
    process.exit(1)
  }
}

bootstrap()

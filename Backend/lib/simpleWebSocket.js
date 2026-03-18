const { randomUUID } = require('crypto')
const { Server } = require('socket.io')

function createRealtimeServer(server, { clientOrigin, database, onError }) {
  const io = new Server(server, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    },
  })

  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {}
      const query = socket.handshake.query || {}
      const room = readParam(auth.room, query.room)
      const userId = readParam(auth.userId, query.userId)

      if (!room || !userId) {
        return next(new Error('Missing room or userId'))
      }

      const user = await database.getUser(userId)
      if (!user || user.room !== room) {
        return next(new Error('User not authorized for this room'))
      }

      socket.data.room = room
      socket.data.userId = userId
      next()
    } catch (error) {
      next(error)
    }
  })

  io.on('connection', (socket) => {
    registerConnection(io, socket, database, onError).catch((error) => {
      onError('Socket connection setup failed', error)
      socket.disconnect(true)
    })
  })

  return io
}

async function registerConnection(io, socket, database, onError) {
  const { room, userId } = socket.data
  socket.join(room)

  const user = await database.setUserOnline(userId, room)
  if (!user) {
    socket.disconnect(true)
    return
  }

  socket.emit('connection:ready', { userId, room })
  socket.emit('history:init', await database.getMessages(room))
  await broadcastParticipants(io, database, room)

  socket.on('message:send', async (payload) => {
    try {
      const text =
        typeof payload?.text === 'string' ? payload.text : payload?.payload?.text
      if (!text || !text.trim()) {
        return
      }

      const activeUser = await database.getUser(userId)
      if (!activeUser || activeUser.room !== room) {
        return
      }

      const message = await database.addMessage({
        id: randomUUID(),
        room,
        userId,
        username: activeUser.username,
        text: text.trim(),
      })
      io.to(room).emit('message:new', message)
    } catch (error) {
      onError('Failed to handle socket message', error)
    }
  })

  socket.on('disconnect', () => {
    database
      .setUserOffline(userId)
      .then(() => broadcastParticipants(io, database, room))
      .catch((error) => onError('Failed to update presence', error))
  })

  socket.on('error', (error) => {
    onError('Socket error', error)
  })
}

async function broadcastParticipants(io, database, room) {
  const participants = await database.getParticipants(room)
  io.to(room).emit('participants:update', participants)
}

function readParam(primary, fallback) {
  if (typeof primary === 'string' && primary.trim()) return primary
  if (typeof fallback === 'string' && fallback.trim()) return fallback
  return null
}

module.exports = createRealtimeServer

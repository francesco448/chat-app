const express = require('express')
const { randomUUID } = require('crypto')
const asyncHandler = require('../utils/asyncHandler')

function createRoomsRouter({ database, io }) {
  const router = express.Router()

  router.post(
    '/:room/join',
    asyncHandler(async (req, res) => {
      const { room } = req.params
      const { username, userId } = req.body

      if (!username || !username.trim()) {
        return res.status(400).json({ error: 'Username is required' })
      }

      const id = userId || randomUUID()
      const user = await database.upsertUser({
        id,
        username: username.trim(),
        room,
      })

      await broadcastParticipants(database, io, room)
      res.json({ user })
    }),
  )

  router.patch(
    '/:room/users/:userId',
    asyncHandler(async (req, res) => {
      const { room, userId } = req.params
      const { username } = req.body

      if (!username || !username.trim()) {
        return res.status(400).json({ error: 'Username is required' })
      }

      const user = await database.getUser(userId)
      if (!user || user.room !== room) {
        return res.status(404).json({ error: 'User not found in this room' })
      }

      const updated = await database.updateUsername(userId, username.trim())
      await broadcastParticipants(database, io, room)
      res.json({ user: updated })
    }),
  )

  router.post(
    '/:room/leave',
    asyncHandler(async (req, res) => {
      const { room } = req.params
      const { userId } = req.body

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
      }

      const user = await database.getUser(userId)
      if (!user || user.room !== room) {
        return res.status(404).json({ error: 'User not found in this room' })
      }

      await database.setUserOffline(userId)
      await broadcastParticipants(database, io, room)
      res.json({ success: true })
    }),
  )

  router.get(
    '/:room/messages',
    asyncHandler(async (req, res) => {
      const { room } = req.params
      const messages = await database.getMessages(room)
      res.json({ messages })
    }),
  )

  router.get(
    '/:room/participants',
    asyncHandler(async (req, res) => {
      const { room } = req.params
      const participants = await database.getParticipants(room)
      res.json({ participants })
    }),
  )

  router.post(
    '/:room/messages',
    asyncHandler(async (req, res) => {
      const { room } = req.params
      const { userId, text } = req.body

      if (!userId || !text || !text.trim()) {
        return res.status(400).json({ error: 'userId and text are required' })
      }

      const user = await database.getUser(userId)
      if (!user || user.room !== room) {
        return res.status(404).json({ error: 'Unknown user or room mismatch' })
      }

      const message = await database.addMessage({
        id: randomUUID(),
        room,
        userId,
        username: user.username,
        text: text.trim(),
      })

      io.to(room).emit('message:new', message)
      res.status(201).json({ message })
    }),
  )

  return router
}

async function broadcastParticipants(database, io, room) {
  const participants = await database.getParticipants(room)
  io.to(room).emit('participants:update', participants)
}

module.exports = createRoomsRouter

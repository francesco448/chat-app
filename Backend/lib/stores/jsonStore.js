const fs = require('fs')
const path = require('path')

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath
    this.state = { users: [], messages: [] }
    this._ensureStore()
  }

  _ensureStore() {
    const dir = path.dirname(this.filePath)
    fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(this.filePath)) {
      this._persist()
      return
    }
    try {
      const contents = fs.readFileSync(this.filePath, 'utf-8')
      this.state = JSON.parse(contents)
    } catch (error) {
      console.warn('JSON store damaged, recreating', error)
      this._persist()
    }
  }

  _persist() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8')
  }

  async upsertUser({ id, username, room }) {
    const trimmed = username?.trim()
    if (!trimmed) {
      throw new Error('Username is required')
    }
    const now = new Date().toISOString()
    const index = this.state.users.findIndex((user) => user.id === id)
    if (index >= 0) {
      const updated = {
        ...this.state.users[index],
        username: trimmed,
        room,
        isOnline: true,
        lastActiveAt: now,
      }
      this.state.users[index] = updated
      this._persist()
      return updated
    }
    const user = {
      id,
      username: trimmed,
      room,
      isOnline: true,
      joinedAt: now,
      lastActiveAt: now,
    }
    this.state.users.push(user)
    this._persist()
    return user
  }

  async setUserOnline(userId, room) {
    const user = this.state.users.find((entry) => entry.id === userId)
    if (!user) {
      return null
    }
    Object.assign(user, {
      isOnline: true,
      room,
      lastActiveAt: new Date().toISOString(),
    })
    this._persist()
    return user
  }

  async setUserOffline(userId) {
    const user = this.state.users.find((entry) => entry.id === userId)
    if (!user) {
      return null
    }
    Object.assign(user, {
      isOnline: false,
      lastActiveAt: new Date().toISOString(),
    })
    this._persist()
    return user
  }

  async updateUsername(userId, username) {
    const user = this.state.users.find((entry) => entry.id === userId)
    if (!user) return null
    user.username = username.trim()
    user.lastActiveAt = new Date().toISOString()
    this._persist()
    return user
  }

  async removeUser(userId) {
    const index = this.state.users.findIndex((entry) => entry.id === userId)
    if (index === -1) return null
    const [removed] = this.state.users.splice(index, 1)
    this._persist()
    return removed
  }

  async getUser(userId) {
    return this.state.users.find((entry) => entry.id === userId) || null
  }

  async getParticipants(room) {
    return this.state.users
      .filter((entry) => entry.room === room)
      .map(({ id, username, isOnline, joinedAt, lastActiveAt }) => ({
        id,
        username,
        isOnline,
        joinedAt,
        lastActiveAt,
      }))
      .sort((a, b) => {
        if (a.isOnline === b.isOnline) {
          return new Date(b.lastActiveAt) - new Date(a.lastActiveAt)
        }
        return a.isOnline ? -1 : 1
      })
  }

  async addMessage({ id, room, userId, username, text }) {
    const message = {
      id,
      room,
      userId,
      username,
      text,
      createdAt: new Date().toISOString(),
    }
    this.state.messages.push(message)
    this._persist()
    return message
  }

  async getMessages(room, limit = 100) {
    return this.state.messages
      .filter((message) => message.room === room)
      .slice(-limit)
  }
}

module.exports = JsonStore

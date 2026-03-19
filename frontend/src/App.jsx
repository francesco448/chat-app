import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { io } from 'socket.io-client'
import { ERROR_MESSAGES } from './constants/errorMessages'
import { validateJoinForm } from './utils/validators'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

function App() {
  const { t } = useTranslation()

  const [username, setUsername] = useState('')
  const [room, setRoom] = useState('general')
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState('idle')
  const [messages, setMessages] = useState([])
  const [participants, setParticipants] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [error, setError] = useState('')

  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)

  const connectionLabel = t(`status.${status}`, { defaultValue: status })
  const isConnected = status === 'connected'

  useEffect(() => {
    if (!session?.id || !session?.room) {
      setStatus('idle')
      return
    }

    let isCancelled = false
    let retryCount = 0
    let reconnectTimer

    const connect = () => {
      if (isCancelled) return
      setStatus(retryCount === 0 ? 'connecting' : 'reconnecting')
      const socket = io(API_URL, {
        auth: {
          room: session.room,
          userId: session.id,
        },
        reconnectionAttempts: 5,
        transports: ['websocket'],
      })
      socketRef.current = socket

      socket.on('connect', () => {
        retryCount = 0
        setStatus('connected')
      })

      socket.io.on('reconnect_attempt', () => {
        if (!isCancelled) {
          setStatus('reconnecting')
        }
      })

      socket.io.on('reconnect_failed', () => {
        if (!isCancelled) {
          setStatus('error')
        }
      })

      socket.on('connect_error', (socketError) => {
        if (isCancelled) return
        setError(socketError.message || ERROR_MESSAGES.connection.failed)
        setStatus('error')
      })

      socket.on('disconnect', (reason) => {
        if (isCancelled) return
        if (reason !== 'io client disconnect' && retryCount < 5) {
          retryCount += 1
          setStatus('reconnecting')
        } else {
          setStatus('error')
        }
      })

      socket.on('history:init', (payload) => {
        setMessages(Array.isArray(payload) ? payload : [])
      })

      socket.on('message:new', (payload) => {
        if (payload) {
          setMessages((prev) => [...prev, payload])
        }
      })

      socket.on('participants:update', (payload) => {
        setParticipants(Array.isArray(payload) ? payload : [])
      })

      socket.on('connection:ready', () => {
        setError('')
      })
    }

    reconnectTimer = setTimeout(() => {
      if (!socketRef.current?.connected && !isCancelled) {
        setStatus('connecting')
      }
    }, 0)

    connect()

    return () => {
      isCancelled = true
      clearTimeout(reconnectTimer)
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [session?.id, session?.room])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const participantCount = participants.length

  const handleJoin = async (event) => {
    event.preventDefault()
    const validationError = validateJoinForm(username, room)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setStatus(session ? 'reconnecting' : 'connecting')
    try {
      const response = await fetch(`${API_URL}/rooms/${encodeURIComponent(room.trim())}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          userId: session?.id,
        }),
      })

      if (!response.ok) {
        throw new Error(ERROR_MESSAGES.api.joinFailed)
      }

      const data = await response.json()
      if (!data?.user) {
        throw new Error(ERROR_MESSAGES.api.noUserReturned)
      }
      setSession(data.user)
      setUsername(data.user.username)
      setRoom(data.user.room)
      await fetchRoomSnapshots(data.user.room)
    } catch (joinError) {
      console.error(joinError)
      setError(joinError.message)
      setStatus('error')
    }
  }

  const fetchRoomSnapshots = async (targetRoom) => {
    const encodedRoom = encodeURIComponent(targetRoom)
    try {
      const [messagesResponse, participantsResponse] = await Promise.all([
        fetch(`${API_URL}/rooms/${encodedRoom}/messages`),
        fetch(`${API_URL}/rooms/${encodedRoom}/participants`),
      ])
      if (messagesResponse.ok) {
        const { messages: history } = await messagesResponse.json()
        setMessages(history)
      }
      if (participantsResponse.ok) {
        const { participants: list } = await participantsResponse.json()
        setParticipants(list)
      }
    } catch (snapshotError) {
      console.warn(t(ERROR_MESSAGES.api.snapshotFailed), snapshotError)
    }
  }

  const handleSendMessage = (event) => {
    event.preventDefault()
    if (!session || !messageInput.trim()) {
      return
    }
    const socket = socketRef.current
    if (!socket || !socket.connected) {
      setError(ERROR_MESSAGES.connection.noActiveConnection)
      return
    }
    try {
      socket.emit('message:send', {
        text: messageInput.trim(),
      })
      setMessageInput('')
      setError('')
    } catch (sendError) {
      console.error(sendError)
      setError(ERROR_MESSAGES.connection.sendFailed)
    }
  }

  const handleLeave = async () => {
    if (!session) return
    try {
      await fetch(`${API_URL}/rooms/${encodeURIComponent(session.room)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.id }),
      })
    } catch (leaveError) {
      console.warn(t(ERROR_MESSAGES.api.leaveFailed), leaveError)
    } finally {
      setSession(null)
      setMessages([])
      setParticipants([])
      setStatus('idle')
    }
  }

  const connectionHint = useMemo(() => {
    if (!session) return t('hint.noSession')
    switch (status) {
      case 'connecting':   return t('hint.connecting')
      case 'reconnecting': return t('hint.reconnecting')
      case 'error':        return t('hint.error')
      default:             return t('hint.joined', { room: session.room, username: session.username })
    }
  }, [session, status, t])

  return (
    <div className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t('app.title')}</p>
          <h1>{t('app.headline')}</h1>
          <p>{connectionHint}</p>
        </div>
        <div className={`status-badge status-${status}`}>
          <span className="status-dot" aria-hidden="true"></span>
          {connectionLabel}
        </div>
      </header>

      <section className="panel">
        <form className="session-form" onSubmit={handleJoin}>
          <div className="field-group">
            <label htmlFor="username">{t('form.username')}</label>
            <input
              id="username"
              value={username}
              placeholder={t('form.usernamePlaceholder')}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="field-group">
            <label htmlFor="room">{t('form.room')}</label>
            <input
              id="room"
              value={room}
              placeholder={t('form.roomPlaceholder')}
              onChange={(event) => setRoom(event.target.value.toLowerCase())}
            />
          </div>
          <div className="actions">
            <button type="submit">
              {session ? t('form.update') : t('form.connect')}
            </button>
            {session ? (
              <button type="button" className="ghost" onClick={handleLeave}>
                {t('form.leave')}
              </button>
            ) : null}
          </div>
        </form>
        {error ? <p className="form-error">{t(error)}</p> : null}
      </section>

      <main className="chat-grid">
        <section className="chat-panel">
          <header className="chat-panel__header">
            <div>
              <h2>{t('chat.title')}</h2>
              <p>{t('chat.liveFeed', { room: session?.room ?? room })}</p>
            </div>
            <span className="muted">{t('chat.messageCount', { count: messages.length })}</span>
          </header>
          <div className="chat-panel__body">
            {messages.length === 0 ? (
              <p className="empty-state">{t('chat.empty')}</p>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={`message ${message.userId === session?.id ? 'me' : ''}`}
                >
                  <header>
                    <strong>{message.username}</strong>
                    <span>{formatTime(message.createdAt)}</span>
                  </header>
                  <p>{message.text}</p>
                </article>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <form className="composer" onSubmit={handleSendMessage}>
            <input
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              placeholder={session ? t('chat.placeholder') : t('chat.placeholderDisabled')}
              disabled={!session || !isConnected}
            />
            <button
              type="submit"
              disabled={!session || !messageInput.trim() || !isConnected}
            >
              {t('chat.send')}
            </button>
          </form>
        </section>
        <aside className="participants-panel">
          <header>
            <h2>{t('participants.title')}</h2>
            <span>{participantCount}</span>
          </header>
          <ul>
            {participants.length === 0 ? (
              <li className="muted">{t('participants.empty')}</li>
            ) : (
              participants.map((participant) => (
                <li key={participant.id}>
                  <span
                    className={`presence ${participant.isOnline ? 'online' : 'away'}`}
                    aria-label={participant.isOnline ? t('participants.online') : 'offline'}
                  ></span>
                  <div>
                    <p>{participant.username}</p>
                    <small>
                      {participant.isOnline
                        ? t('participants.online')
                        : t('participants.lastActive', { time: formatRelativeTime(participant.lastActiveAt) })}
                    </small>
                  </div>
                </li>
              ))
            )}
          </ul>
        </aside>
      </main>
    </div>
  )
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const formatter = new Intl.RelativeTimeFormat('de', { numeric: 'auto' })
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffInMinutes = Math.round((then - now) / (1000 * 60))

  if (Math.abs(diffInMinutes) < 60) {
    return formatter.format(diffInMinutes, 'minute')
  }
  const diffInHours = Math.round(diffInMinutes / 60)
  if (Math.abs(diffInHours) < 24) {
    return formatter.format(diffInHours, 'hour')
  }
  const diffInDays = Math.round(diffInHours / 24)
  return formatter.format(diffInDays, 'day')
}

export default App

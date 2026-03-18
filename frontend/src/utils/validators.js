import { ERROR_MESSAGES } from '../constants/errorMessages'

export function validateRequired(value, message) {
  if (!value || !String(value).trim()) return message
  return null
}

export function validateJoinForm(username, room) {
  if (!username.trim() || !room.trim()) {
    return ERROR_MESSAGES.form.usernameAndRoomRequired
  }
  return null
}

export function validateUsername(username) {
  return validateRequired(username, ERROR_MESSAGES.form.usernameRequired)
}

export function validateRoom(room) {
  return validateRequired(room, ERROR_MESSAGES.form.roomRequired)
}

export function validateMessageText(text) {
  return validateRequired(text, ERROR_MESSAGES.form.messageTextRequired)
}

// Translation keys for all error messages.
// Values must match the keys defined in src/locales/de/translation.json.
// Callers pass these to t() — e.g. t(ERROR_MESSAGES.form.usernameRequired).

export const ERROR_MESSAGES = {
  form: {
    usernameRequired: 'error.form.usernameRequired',
    roomRequired: 'error.form.roomRequired',
    usernameAndRoomRequired: 'error.form.usernameAndRoomRequired',
    userIdRequired: 'error.form.userIdRequired',
    messageTextRequired: 'error.form.messageTextRequired',
  },
  connection: {
    failed: 'error.connection.failed',
    noActiveConnection: 'error.connection.noActiveConnection',
    interrupted: 'error.connection.interrupted',
    sendFailed: 'error.connection.sendFailed',
  },
  api: {
    joinFailed: 'error.api.joinFailed',
    noUserReturned: 'error.api.noUserReturned',
    snapshotFailed: 'error.api.snapshotFailed',
    leaveFailed: 'error.api.leaveFailed',
  },
}

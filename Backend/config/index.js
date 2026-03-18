const fs = require('fs')
const path = require('path')

loadLocalEnv()

module.exports = {
  port: process.env.PORT || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
}

function loadLocalEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) {
    return
  }

  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue

    const [key, ...rest] = line.split('=')
    if (!key) continue

    const value = rest.join('=').trim()
    if (key && value && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

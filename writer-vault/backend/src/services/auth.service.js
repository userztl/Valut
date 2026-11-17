const crypto = require('crypto')
const { run, get } = require('../db/sqlite')

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 会话有效期 7 天

/**
 * 校验密码哈希是否匹配
 * @param {string} password 明文密码
 * @param {string} stored salt:hash 格式存储串
 * @returns {boolean} 是否匹配
 */
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'))
}

/**
 * 登录：校验账号密码并创建会话令牌
 * @param {{username: string, password: string}} payload 登录凭证
 * @returns {Promise<{token: string, username: string}>} 令牌与用户名
 * @throws {Error} 账号或密码错误时抛出（statusCode=401，文案由后端统一下发）
 */
async function login({ username, password }) {
  const user = await get('SELECT id, username, password_hash FROM users WHERE username = ?', [username])
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw Object.assign(new Error('用户名或密码错误'), { statusCode: 401 })
  }
  const token = crypto.randomBytes(32).toString('hex')
  await run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [
    token,
    user.id,
    new Date(Date.now() + SESSION_TTL_MS).toISOString()
  ])
  return { token, username: user.username }
}

/**
 * 校验会话令牌
 * @param {string} token 会话令牌
 * @returns {Promise<{id: number, username: string}|null>} 用户信息，无效/过期返回 null
 */
async function verifyToken(token) {
  if (!token) return null
  return get(
    `SELECT u.id, u.username FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    [token, new Date().toISOString()]
  )
}

/**
 * 登出：删除会话
 * @param {string} token 会话令牌
 * @returns {Promise<void>}
 */
async function logout(token) {
  await run('DELETE FROM sessions WHERE token = ?', [token])
}

module.exports = { login, verifyToken, logout }

const authService = require('../services/auth.service')

/**
 * 登录鉴权中间件：校验 Bearer 令牌，通过后挂载 req.user
 * @param {import('express').Request} req 请求对象
 * @param {import('express').Response} res 响应对象
 * @param {import('express').NextFunction} next 下一步中间件
 */
async function authRequired(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const user = await authService.verifyToken(token)
    if (!user) {
      return res.status(401).json({ code: 401, message: '登录已过期，请重新登录', data: null })
    }
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = { authRequired }

const express = require('express')
const authService = require('../services/auth.service')
const { ok } = require('../middleware/response')

const router = express.Router()

/**
 * 登录
 */
router.post('/login', async (req, res, next) => {
  try {
    ok(res, await authService.login(req.body || {}))
  } catch (err) {
    next(err)
  }
})

/**
 * 登出
 */
router.post('/logout', async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (token) await authService.logout(token)
    ok(res)
  } catch (err) {
    next(err)
  }
})

/**
 * 当前登录用户
 */
router.get('/me', async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    ok(res, await authService.verifyToken(token))
  } catch (err) {
    next(err)
  }
})

module.exports = router

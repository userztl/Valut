const express = require('express')
const authRoutes = require('./auth.routes')
const folderRoutes = require('./folder.routes')
const itemRoutes = require('./item.routes')
const cardRoutes = require('./card.routes')
const canvasRoutes = require('./canvas.routes')
const { authRequired } = require('../middleware/auth')

const router = express.Router()

// 登录相关接口无需鉴权
router.use('/auth', authRoutes)

// 其余业务接口统一鉴权
router.use(authRequired)
router.use('/folders', folderRoutes)
router.use('/items', itemRoutes)
router.use('/cards', cardRoutes)
router.use('/canvas', canvasRoutes)

module.exports = router

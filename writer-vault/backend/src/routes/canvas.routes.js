const express = require('express')
const service = require('../services/canvas.service')
const { ok } = require('../middleware/response')

const router = express.Router()

/**
 * 读取画布快照
 */
router.get('/:canvasId', async (req, res, next) => {
  try {
    ok(res, await service.getCanvas(Number(req.params.canvasId)))
  } catch (err) {
    next(err)
  }
})

/**
 * 保存画布快照（整体覆盖）
 */
router.put('/:canvasId', async (req, res, next) => {
  try {
    await service.saveCanvas(Number(req.params.canvasId), req.body || {})
    ok(res)
  } catch (err) {
    next(err)
  }
})

module.exports = router

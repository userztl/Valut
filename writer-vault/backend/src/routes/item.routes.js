const express = require('express')
const service = require('../services/item.service')
const { ok } = require('../middleware/response')

const router = express.Router()

/**
 * 条目详情（文档内容 / 画布条目信息）
 */
router.get('/:id', async (req, res, next) => {
  try {
    ok(res, await service.getItem(Number(req.params.id)))
  } catch (err) {
    next(err)
  }
})

/**
 * 创建条目（type: doc | canvas）
 */
router.post('/', async (req, res, next) => {
  try {
    ok(res, await service.createItem(req.body || {}))
  } catch (err) {
    next(err)
  }
})

/**
 * 更新条目（标题/内容，内容更新时重建双链索引）
 */
router.put('/:id', async (req, res, next) => {
  try {
    await service.updateItem(Number(req.params.id), req.body || {})
    ok(res)
  } catch (err) {
    next(err)
  }
})

/**
 * 删除条目
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await service.removeItem(Number(req.params.id))
    ok(res)
  } catch (err) {
    next(err)
  }
})

module.exports = router

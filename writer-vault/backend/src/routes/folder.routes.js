const express = require('express')
const service = require('../services/folder.service')
const { ok } = require('../middleware/response')

const router = express.Router()

/**
 * 目录树数据（目录 + 条目扁平列表）
 */
router.get('/tree', async (req, res, next) => {
  try {
    ok(res, await service.listTree())
  } catch (err) {
    next(err)
  }
})

/**
 * 创建目录
 */
router.post('/', async (req, res, next) => {
  try {
    ok(res, await service.createFolder(req.body || {}))
  } catch (err) {
    next(err)
  }
})

/**
 * 更新目录（重命名 / 移动 / 排序）
 */
router.put('/:id', async (req, res, next) => {
  try {
    await service.updateFolder(Number(req.params.id), req.body || {})
    ok(res)
  } catch (err) {
    next(err)
  }
})

/**
 * 删除目录
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await service.removeFolder(Number(req.params.id))
    ok(res)
  } catch (err) {
    next(err)
  }
})

module.exports = router

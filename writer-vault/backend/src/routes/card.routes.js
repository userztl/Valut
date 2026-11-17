const express = require('express')
const service = require('../services/card.service')
const { ok } = require('../middleware/response')

const router = express.Router()

/**
 * 卡片列表（?q= 标题模糊搜索）
 */
router.get('/', async (req, res, next) => {
  try {
    ok(res, await service.listCards(req.query.q))
  } catch (err) {
    next(err)
  }
})

/**
 * 按标题精确查询（双链跳转，不存在返回 null）
 */
router.get('/by-title/:title', async (req, res, next) => {
  try {
    ok(res, (await service.getCardByTitle(req.params.title)) || null)
  } catch (err) {
    next(err)
  }
})

/**
 * 卡片详情
 */
router.get('/:id', async (req, res, next) => {
  try {
    ok(res, await service.getCard(Number(req.params.id)))
  } catch (err) {
    next(err)
  }
})

/**
 * 创建卡片（同标题复用既有卡片）
 */
router.post('/', async (req, res, next) => {
  try {
    ok(res, await service.createCard(req.body || {}))
  } catch (err) {
    next(err)
  }
})

/**
 * 更新卡片
 */
router.put('/:id', async (req, res, next) => {
  try {
    await service.updateCard(Number(req.params.id), req.body || {})
    ok(res)
  } catch (err) {
    next(err)
  }
})

/**
 * 删除卡片
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await service.removeCard(Number(req.params.id))
    ok(res)
  } catch (err) {
    next(err)
  }
})

module.exports = router

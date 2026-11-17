const express = require('express')
const cors = require('cors')
const routes = require('./routes')
const { errorHandler } = require('./middleware/error')
const { migrate } = require('./db/migrate')

/**
 * 创建并装配 Express 应用实例
 * @returns {Promise<import('express').Express>} 完成数据库迁移后的应用实例
 * @throws {Error} 迁移失败时抛出，由启动流程中止服务
 */
async function createApp() {
  await migrate()
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))
  app.use('/api', routes)
  app.use(errorHandler)
  return app
}

module.exports = { createApp }

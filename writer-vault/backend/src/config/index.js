/**
 * 运行时配置：统一从环境变量读取，容器与本地开发共用同一入口
 */
module.exports = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || './data/app.db'
}

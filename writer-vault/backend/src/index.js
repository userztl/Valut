const config = require('./config')
const { createApp } = require('./app')

/**
 * 服务启动入口：完成迁移后监听配置端口
 * @throws {Error} 启动失败时输出错误并退出进程
 */
createApp()
  .then((app) => {
    app.listen(config.port, () => {
      console.log(`[backend] listening on :${config.port}`)
    })
  })
  .catch((err) => {
    console.error('[backend] start failed:', err)
    process.exit(1)
  })

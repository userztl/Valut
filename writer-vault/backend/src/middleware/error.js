/**
 * 全局错误处理中间件：业务错误透传后端文案，未知异常统一兜底
 * @param {Error} err 错误对象（可携带 statusCode 与 message）
 * @param {import('express').Request} req 请求对象
 * @param {import('express').Response} res 响应对象
 * @param {import('express').NextFunction} next 下一步中间件
 */
function errorHandler(err, req, res, next) {
  const isBusiness = Number.isInteger(err.statusCode)
  if (!isBusiness) console.error('[error]', err)
  res.status(isBusiness ? err.statusCode : 500).json({
    code: isBusiness ? err.statusCode : 500,
    message: isBusiness ? err.message : '服务繁忙，请稍后重试',
    data: null
  })
}

module.exports = { errorHandler }

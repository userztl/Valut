/**
 * 统一成功响应包装：所有业务提示文案由后端统一下发
 * @param {import('express').Response} res 响应对象
 * @param {*} data 业务数据
 * @param {string} message 提示文案
 */
function ok(res, data = null, message = 'ok') {
  res.json({ code: 0, message, data })
}

/**
 * 统一失败响应包装
 * @param {import('express').Response} res 响应对象
 * @param {number} code 业务错误码
 * @param {string} message 提示文案（由后端下发，前端直接展示）
 * @param {number} [status] HTTP 状态码，默认 200
 */
function fail(res, code, message, status = 200) {
  res.status(status).json({ code, message, data: null })
}

module.exports = { ok, fail }

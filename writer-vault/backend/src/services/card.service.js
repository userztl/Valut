const { run, get, all } = require('../db/sqlite')

/**
 * 卡片列表（支持按标题模糊搜索）
 * @param {string} [keyword] 搜索关键词（空返回全部）
 * @returns {Promise<Array<Object>>} 卡片列表
 * @throws {Error} 数据库操作失败时抛出
 */
async function listCards(keyword) {
  if (keyword) {
    return all('SELECT * FROM cards WHERE title LIKE ? ORDER BY updated_at DESC', [`%${keyword}%`])
  }
  return all('SELECT * FROM cards ORDER BY updated_at DESC')
}

/**
 * 按 ID 查询卡片
 * @param {number} id 卡片 ID
 * @returns {Promise<Object|undefined>} 卡片详情
 * @throws {Error} 数据库操作失败时抛出
 */
async function getCard(id) {
  return get('SELECT * FROM cards WHERE id = ?', [id])
}

/**
 * 按标题精确查询卡片（双链跳转入口）
 * @param {string} title 卡片标题
 * @returns {Promise<Object|undefined>} 卡片详情，不存在返回 undefined
 * @throws {Error} 数据库操作失败时抛出
 */
async function getCardByTitle(title) {
  return get('SELECT * FROM cards WHERE title = ?', [title])
}

/**
 * 创建卡片（同标题已存在时直接返回既有卡片，保证双链唯一指向）
 * @param {{title: string, content?: string, color?: string}} payload 卡片信息
 * @returns {Promise<{id: number, created: boolean}>} 卡片 ID 与是否新建
 * @throws {Error} 数据库操作失败时抛出
 */
async function createCard({ title, content = '', color }) {
  const existing = await getCardByTitle(title)
  if (existing) return { id: existing.id, created: false }
  const result = await run('INSERT INTO cards (title, content, color) VALUES (?, ?, ?)', [
    title, content, color || '#5c6bc0'
  ])
  return { id: result.lastID, created: true }
}

/**
 * 更新卡片
 * @param {number} id 卡片 ID
 * @param {{title?: string, content?: string, color?: string}} patch 更新内容
 * @returns {Promise<void>}
 * @throws {Error} 数据库操作失败时抛出
 */
async function updateCard(id, { title, content, color }) {
  await run(
    `UPDATE cards SET
       title = COALESCE(?, title),
       content = COALESCE(?, content),
       color = COALESCE(?, color),
       updated_at = datetime('now', 'localtime')
     WHERE id = ?`,
    [title === undefined ? null : title, content === undefined ? null : content, color === undefined ? null : color, id]
  )
}

/**
 * 删除卡片
 * @param {number} id 卡片 ID
 * @returns {Promise<void>}
 * @throws {Error} 数据库操作失败时抛出
 */
async function removeCard(id) {
  await run('DELETE FROM cards WHERE id = ?', [id])
}

module.exports = { listCards, getCard, getCardByTitle, createCard, updateCard, removeCard }

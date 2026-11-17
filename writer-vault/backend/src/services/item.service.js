const { run, get, all, transaction } = require('../db/sqlite')

/**
 * 从富文本 HTML 中提取 [[双链]] 目标（去重）
 * @param {string} content 富文本 HTML
 * @returns {Array<string>} 引用目标标题列表
 */
function extractLinks(content) {
  return [...new Set([...String(content || '').matchAll(/\[\[([^\[\]]+)\]\]/g)].map((m) => m[1]))]
}

/**
 * 查询条目详情
 * @param {number} id 条目 ID
 * @returns {Promise<Object|undefined>} 条目详情
 * @throws {Error} 数据库操作失败时抛出
 */
async function getItem(id) {
  return get('SELECT * FROM items WHERE id = ?', [id])
}

/**
 * 创建条目（文档/画布）：sort 取同级最小值-1，新建条目默认置顶
 * @param {{folder_id?: number|null, type?: 'doc'|'canvas', title?: string}} payload 条目信息
 * @returns {Promise<{id: number}>} 新条目 ID
 * @throws {Error} 数据库操作失败时抛出
 */
async function createItem({ folder_id = null, type = 'doc', title }) {
  const parentId = folder_id ?? null
  const row = await get(
    'SELECT COALESCE(MIN(sort), 0) - 1 AS sort FROM items WHERE folder_id IS ?',
    [parentId]
  )
  const result = await run('INSERT INTO items (folder_id, type, title, sort) VALUES (?, ?, ?, ?)', [
    parentId, type, title || '未命名', row ? row.sort : 0
  ])
  return { id: result.lastID }
}

/**
 * 更新条目：标题/内容/归属目录/排序（字段均可选），内容变更时同步重建 [[]] 双链索引
 * @param {number} id 条目 ID
 * @param {{title?: string, content?: string, folder_id?: number|null, sort?: number}} patch 更新内容
 * @throws {Error} 事务内任一步失败即整体回滚
 */
async function updateItem(id, patch = {}) {
  const { title, content, sort } = patch
  const sets = ['updated_at = datetime(\'now\', \'localtime\')']
  const params = []
  if (title !== undefined) {
    sets.push('title = ?')
    params.push(title)
  }
  if (content !== undefined) {
    sets.push('content = ?')
    params.push(content)
  }
  if ('folder_id' in patch) {
    sets.push('folder_id = ?')
    params.push(patch.folder_id ?? null)
  }
  if (sort !== undefined) {
    sets.push('sort = ?')
    params.push(sort)
  }
  const statements = [
    { sql: `UPDATE items SET ${sets.join(', ')} WHERE id = ?`, params: [...params, id] }
  ]
  if (content !== undefined) {
    statements.push({ sql: 'DELETE FROM wiki_links WHERE source_item_id = ?', params: [id] })
    for (const target of extractLinks(content)) {
      statements.push({ sql: 'INSERT INTO wiki_links (source_item_id, target) VALUES (?, ?)', params: [id, target] })
    }
  }
  await transaction(statements)
}

/**
 * 删除条目（画布节点/连线、双链索引级联清理）
 * @param {number} id 条目 ID
 * @returns {Promise<void>}
 * @throws {Error} 数据库操作失败时抛出
 */
async function removeItem(id) {
  await run('DELETE FROM items WHERE id = ?', [id])
}

module.exports = { getItem, createItem, updateItem, removeItem, extractLinks }

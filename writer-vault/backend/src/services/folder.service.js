const { all, run, get } = require('../db/sqlite')

/**
 * 目录树数据：返回全部目录与条目（扁平结构，由前端组装树）
 * @returns {Promise<{folders: Array<Object>, items: Array<Object>}>} 目录与条目列表
 * @throws {Error} 数据库操作失败时抛出
 */
async function listTree() {
  const [folders, items] = await Promise.all([
    all('SELECT id, parent_id, name, sort FROM folders ORDER BY sort, id'),
    all('SELECT id, folder_id, type, title, sort, updated_at FROM items ORDER BY sort, id')
  ])
  return { folders, items }
}

/**
 * 创建目录
 * @param {{parent_id?: number|null, name: string, sort?: number}} payload 目录信息
 * @returns {Promise<{id: number}>} 新目录 ID
 * @throws {Error} 数据库操作失败时抛出
 */
async function createFolder({ parent_id = null, name, sort = 0 }) {
  const result = await run('INSERT INTO folders (parent_id, name, sort) VALUES (?, ?, ?)', [
    parent_id ?? null, name, sort
  ])
  return { id: result.lastID }
}

/**
 * 更新目录：重命名 / 移动父级 / 排序（字段均可选，parent_id 显式传 null 表示移到根）
 * @param {number} id 目录 ID
 * @param {{name?: string, parent_id?: number|null, sort?: number}} patch 需要更新的字段
 * @throws {Error} 目标父级为自身或其后代（成环）时抛出
 */
async function updateFolder(id, patch = {}) {
  const sets = []
  const params = []
  if (patch.name !== undefined) {
    sets.push('name = ?')
    params.push(patch.name)
  }
  if ('parent_id' in patch) {
    const parentId = patch.parent_id ?? null
    if (parentId !== null) {
      if (parentId === id) throw new Error('不能将目录移动到自身之下')
      // 沿父链上溯：若途经自身说明目标是自身后代，会成环
      let cursor = parentId
      while (cursor !== null) {
        if (cursor === id) throw new Error('不能将目录移动到其子目录之下')
        const row = await get('SELECT parent_id FROM folders WHERE id = ?', [cursor])
        cursor = row ? row.parent_id : null
      }
    }
    sets.push('parent_id = ?')
    params.push(parentId)
  }
  if (patch.sort !== undefined) {
    sets.push('sort = ?')
    params.push(patch.sort)
  }
  if (!sets.length) return
  params.push(id)
  await run(`UPDATE folders SET ${sets.join(', ')} WHERE id = ?`, params)
}

/**
 * 删除目录（子目录级联删除，目录下条目挂到根目录）
 * @param {number} id 目录 ID
 * @returns {Promise<void>}
 * @throws {Error} 数据库操作失败时抛出
 */
async function removeFolder(id) {
  await run('DELETE FROM folders WHERE id = ?', [id])
}

module.exports = { listTree, createFolder, updateFolder, removeFolder }

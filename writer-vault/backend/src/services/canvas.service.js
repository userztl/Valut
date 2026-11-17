const { all, transaction } = require('../db/sqlite')

/**
 * 查询单个画布快照（节点联卡片表取标题兜底与摘要）
 * @param {number} canvasId 画布条目 ID
 * @returns {Promise<{nodes: Array<Object>, edges: Array<Object>}>} 画布数据
 * @throws {Error} 数据库操作失败时抛出
 */
async function getCanvas(canvasId) {
  const [nodes, edges] = await Promise.all([
    all(
      `SELECT n.node_key, n.card_id, n.label, n.x, n.y,
              c.title  AS card_title,
              c.content AS card_content,
              c.color  AS card_color
       FROM canvas_nodes n
       LEFT JOIN cards c ON c.id = n.card_id
       WHERE n.canvas_id = ?
       ORDER BY n.id`,
      [canvasId]
    ),
    all('SELECT source_key, target_key, label FROM canvas_edges WHERE canvas_id = ? ORDER BY id', [canvasId])
  ])
  return { nodes, edges }
}

/**
 * 保存画布快照：整体覆盖式写入，事务保证节点与连线一致
 * @param {number} canvasId 画布条目 ID
 * @param {{nodes: Array, edges: Array}} snapshot 前端画布快照
 * @throws {Error} 事务内任一语句失败即整体回滚
 */
async function saveCanvas(canvasId, { nodes = [], edges = [] }) {
  const statements = [
    { sql: 'DELETE FROM canvas_edges WHERE canvas_id = ?', params: [canvasId] },
    { sql: 'DELETE FROM canvas_nodes WHERE canvas_id = ?', params: [canvasId] }
  ]
  for (const n of nodes) {
    statements.push({
      sql: 'INSERT INTO canvas_nodes (canvas_id, node_key, card_id, label, x, y) VALUES (?, ?, ?, ?, ?, ?)',
      params: [canvasId, String(n.id), n.cardId === undefined || n.cardId === null ? null : n.cardId, n.label || '', Number(n.x) || 0, Number(n.y) || 0]
    })
  }
  for (const e of edges) {
    statements.push({
      sql: 'INSERT INTO canvas_edges (canvas_id, source_key, target_key, label) VALUES (?, ?, ?, ?)',
      params: [canvasId, String(e.source), String(e.target), e.label || '']
    })
  }
  await transaction(statements)
}

module.exports = { getCanvas, saveCanvas }

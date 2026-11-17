const crypto = require('crypto')
const { run, get, all, transaction, getWriteDb } = require('./sqlite')

/**
 * 生成密码哈希（scrypt，格式 salt:hash）
 * @param {string} password 明文密码
 * @returns {string} salt:hash 格式的哈希串
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/**
 * 幂等执行建表迁移：字段注释以 -- 行内注释形式沉淀，便于后续管理与理解
 * @throws {Error} SQL 执行失败时抛出，由启动流程中止服务
 */
async function migrate() {
  await transaction([
    {
      // 用户表：本地登录账号
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id            INTEGER PRIMARY KEY AUTOINCREMENT, -- 用户ID
          username      TEXT    NOT NULL UNIQUE,           -- 登录名
          password_hash TEXT    NOT NULL,                  -- 密码哈希（scrypt，格式 salt:hash）
          created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')) -- 创建时间
        )
      `
    },
    {
      // 会话表：登录令牌（支撑简单登录态）
      sql: `
        CREATE TABLE IF NOT EXISTS sessions (
          token      TEXT    PRIMARY KEY,        -- 会话令牌（64位随机hex，请求头 Bearer 携带）
          user_id    INTEGER NOT NULL,           -- 所属用户ID
          expires_at TEXT    NOT NULL,           -- 过期时间（ISO 字符串）
          created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `
    },
    {
      // 目录表：目录树节点（支持多级）
      sql: `
        CREATE TABLE IF NOT EXISTS folders (
          id         INTEGER PRIMARY KEY AUTOINCREMENT, -- 目录ID
          parent_id  INTEGER,                           -- 父目录ID（NULL=根目录）
          name       TEXT    NOT NULL,                  -- 目录名称
          sort       INTEGER NOT NULL DEFAULT 0,        -- 同级排序权重（小在前）
          created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
        )
      `
    },
    {
      // 条目表：文档与画布统一挂载到目录树下
      sql: `
        CREATE TABLE IF NOT EXISTS items (
          id         INTEGER PRIMARY KEY AUTOINCREMENT, -- 条目ID
          folder_id  INTEGER,                           -- 所属目录ID（NULL=根目录）
          type       TEXT    NOT NULL DEFAULT 'doc',    -- 类型：doc=文档 / canvas=画布
          title      TEXT    NOT NULL DEFAULT '未命名',  -- 标题
          content    TEXT    NOT NULL DEFAULT '',       -- 内容（doc=富文本HTML；canvas 不使用）
          created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
        )
      `
    },
    {
      // 卡片表：全局设定卡片库（人物/地点/物品等，可拖入画布、可被 [[]] 双链引用）
      sql: `
        CREATE TABLE IF NOT EXISTS cards (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,  -- 卡片ID
          title      TEXT    NOT NULL,                   -- 卡片标题（双链按标题精确匹配）
          content    TEXT    NOT NULL DEFAULT '',        -- 详细设定内容
          color      TEXT    NOT NULL DEFAULT '#5c6bc0', -- 卡片左侧色条颜色
          created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
        )
      `
    },
    {
      // 画布节点表：卡片在画布上的实例（含坐标）
      sql: `
        CREATE TABLE IF NOT EXISTS canvas_nodes (
          id        INTEGER PRIMARY KEY AUTOINCREMENT, -- 节点ID
          canvas_id INTEGER NOT NULL,                  -- 所属画布条目ID（items.id 且 type=canvas）
          node_key  TEXT    NOT NULL,                  -- 前端节点唯一键
          card_id   INTEGER,                           -- 关联卡片ID（NULL=自由节点）
          label     TEXT    NOT NULL DEFAULT '',       -- 节点标题（空则回退卡片标题）
          x         REAL    NOT NULL DEFAULT 0,        -- 画布X坐标
          y         REAL    NOT NULL DEFAULT 0,        -- 画布Y坐标
          UNIQUE (canvas_id, node_key),
          FOREIGN KEY (canvas_id) REFERENCES items(id) ON DELETE CASCADE,
          FOREIGN KEY (card_id)   REFERENCES cards(id) ON DELETE SET NULL
        )
      `
    },
    {
      // 画布连线表：节点间关系（如"师徒"）
      sql: `
        CREATE TABLE IF NOT EXISTS canvas_edges (
          id         INTEGER PRIMARY KEY AUTOINCREMENT, -- 连线ID
          canvas_id  INTEGER NOT NULL,                  -- 所属画布条目ID
          source_key TEXT    NOT NULL,                  -- 起点节点键
          target_key TEXT    NOT NULL,                  -- 终点节点键
          label      TEXT    NOT NULL DEFAULT '',       -- 关系描述
          FOREIGN KEY (canvas_id) REFERENCES items(id) ON DELETE CASCADE
        )
      `
    },
    {
      // 双链表：文档保存时解析 [[]] 引用生成的索引（供后续关系图谱使用）
      sql: `
        CREATE TABLE IF NOT EXISTS wiki_links (
          id             INTEGER PRIMARY KEY AUTOINCREMENT, -- 记录ID
          source_item_id INTEGER NOT NULL,                  -- 来源文档条目ID
          target         TEXT    NOT NULL,                  -- 引用目标（卡片标题）
          FOREIGN KEY (source_item_id) REFERENCES items(id) ON DELETE CASCADE
        )
      `
    }
  ])

  // 增量迁移：items 表补 sort 列（旧库无此列，支撑目录树拖拽排序）
  const itemCols = await all('PRAGMA table_info(items)')
  if (!itemCols.some((c) => c.name === 'sort')) {
    await run('ALTER TABLE items ADD COLUMN sort INTEGER NOT NULL DEFAULT 0')
    console.log('[migrate] added column items.sort')
  }

  await seedDefaultAdmin()
}

/**
 * 种子数据：users 为空时创建默认管理员（首次启动后请尽快修改密码）
 * @throws {Error} 写入失败时抛出
 */
async function seedDefaultAdmin() {
  const row = await get('SELECT COUNT(*) AS n FROM users')
  if (row && row.n > 0) return
  await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [
    'admin',
    hashPassword('admin123')
  ])
  console.log('[migrate] seeded default admin (admin / admin123)')
}

module.exports = { migrate, hashPassword }

// 直接执行时运行迁移
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('[migrate] done')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[migrate] failed:', err)
      process.exit(1)
    })
}

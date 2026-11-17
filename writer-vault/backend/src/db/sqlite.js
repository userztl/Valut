const path = require('path')
const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()
const config = require('../config')

let writeDb = null
let readDb = null

/**
 * 创建一个 SQLite 连接并应用基础 PRAGMA
 * WAL 模式允许"单写者 + 多读者"并行，是实现同库读写分离的前提
 * @returns {sqlite3.Database} 已配置好的连接
 * @throws {Error} 目录创建失败或连接失败时抛出
 */
function createConnection() {
  const dbPath = path.resolve(config.dbPath)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new sqlite3.Database(dbPath)
  db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL')
    db.run('PRAGMA foreign_keys = ON')
    db.run('PRAGMA busy_timeout = 5000')
  })
  return db
}

/**
 * 获取写连接（单例）：所有写操作走此连接，WAL 下单写者串行，避免 SQLITE_BUSY
 * @returns {sqlite3.Database} 写连接
 */
function getWriteDb() {
  if (!writeDb) writeDb = createConnection()
  return writeDb
}

/**
 * 获取只读连接（单例）：query_only 兜底防止误写，读操作与写操作互不阻塞
 * @returns {sqlite3.Database} 只读连接
 */
function getReadDb() {
  if (!readDb) {
    readDb = createConnection()
    readDb.run('PRAGMA query_only = ON')
  }
  return readDb
}

/**
 * 执行写语句（INSERT/UPDATE/DELETE，走写连接）
 * @param {string} sql SQL 语句
 * @param {Array} params 绑定参数
 * @returns {Promise<{lastID: number, changes: number}>} 写入结果
 * @throws {Error} SQL 执行失败时抛出
 */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getWriteDb().run(sql, params, function (err) {
      if (err) return reject(err)
      resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

/**
 * 执行建表/PRAGMA 等无参数语句（走写连接）
 * @param {string} sql SQL 语句
 * @returns {Promise<void>}
 * @throws {Error} SQL 执行失败时抛出
 */
function exec(sql) {
  return new Promise((resolve, reject) => {
    getWriteDb().exec(sql, (err) => (err ? reject(err) : resolve()))
  })
}

/**
 * 查询多行（走只读连接）
 * @param {string} sql SQL 语句
 * @param {Array} params 绑定参数
 * @returns {Promise<Array<Object>>} 结果行
 * @throws {Error} SQL 执行失败时抛出
 */
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getReadDb().all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  })
}

/**
 * 查询单行（走只读连接）
 * @param {string} sql SQL 语句
 * @param {Array} params 绑定参数
 * @returns {Promise<Object|undefined>} 单行结果
 * @throws {Error} SQL 执行失败时抛出
 */
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getReadDb().get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  })
}

/**
 * 事务执行：按序执行多条写语句，任一失败即整体回滚
 * @param {Array<{sql: string, params?: Array}>} statements 语句列表
 * @returns {Promise<void>}
 * @throws {Error} 事务内任一语句失败时回滚并抛出
 */
async function transaction(statements) {
  await exec('BEGIN IMMEDIATE')
  try {
    for (const s of statements) await run(s.sql, s.params || [])
    await exec('COMMIT')
  } catch (err) {
    await exec('ROLLBACK')
    throw err
  }
}

module.exports = { getWriteDb, getReadDb, run, exec, all, get, transaction }

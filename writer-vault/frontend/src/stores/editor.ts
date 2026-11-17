import { defineStore } from 'pinia'
import { ref } from 'vue'
import http from '@/api/http'

export interface FolderMeta {
  id: number
  parent_id: number | null
  name: string
  sort: number
}

export interface ItemMeta {
  id: number
  folder_id: number | null
  type: 'doc' | 'canvas'
  title: string
  sort: number
  updated_at: string
}

export interface ItemDetail {
  id: number
  folder_id: number | null
  type: 'doc' | 'canvas'
  title: string
  content: string
}

/**
 * 目录树与条目状态：树数据缓存 + 当前条目读写
 */
export const useEditorStore = defineStore('editor', () => {
  const folders = ref<FolderMeta[]>([])
  const items = ref<ItemMeta[]>([])
  const current = ref<ItemDetail | null>(null)

  /** 拉取目录树数据（目录 + 条目扁平列表，前端组装树） */
  async function fetchTree() {
    const data = await http.get('/folders/tree')
    folders.value = data.folders || []
    items.value = data.items || []
  }

  /** 拉取条目详情 */
  async function fetchItem(id: number) {
    current.value = await http.get(`/items/${id}`)
  }

  /** 创建条目（type: doc | canvas），返回新条目 ID */
  async function createItem(payload: { folder_id?: number | null; type: 'doc' | 'canvas'; title?: string }) {
    return await http.post('/items', payload)
  }

  /** 保存条目（标题/内容/归属目录/排序），后端自动重建双链索引 */
  async function saveItem(id: number, patch: { title?: string; content?: string; folder_id?: number | null; sort?: number }) {
    await http.put(`/items/${id}`, patch)
  }

  /** 删除条目 */
  async function removeItem(id: number) {
    await http.delete(`/items/${id}`)
  }

  return { folders, items, current, fetchTree, fetchItem, createItem, saveItem, removeItem }
})

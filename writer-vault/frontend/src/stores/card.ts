import { defineStore } from 'pinia'
import { ref } from 'vue'
import http from '@/api/http'
import { useUiStore } from '@/stores/ui'

export interface CardEntity {
  id: number
  title: string
  content: string
  color: string
  updated_at: string
}

/**
 * 全局卡片库状态：搜索、增删改查、双链跳转打开 Inspector
 */
export const useCardStore = defineStore('card', () => {
  const list = ref<CardEntity[]>([])

  /** 拉取卡片列表（keyword 为空返回全部） */
  async function fetchList(keyword?: string) {
    list.value = await http.get('/cards', { params: keyword ? { q: keyword } : {} })
  }

  /** 按标题打开 Inspector：不存在则自动创建（双链唯一指向） */
  async function openByTitle(title: string) {
    const ui = useUiStore()
    let card = await http.get(`/cards/by-title/${encodeURIComponent(title)}`)
    if (!card) {
      card = await http.post('/cards', { title })
    }
    ui.openInspectorCard(card.id)
  }

  /** 更新卡片（标题/内容/颜色） */
  async function updateCard(id: number, patch: { title?: string; content?: string; color?: string }) {
    await http.put(`/cards/${id}`, patch)
  }

  /** 删除卡片 */
  async function removeCard(id: number) {
    await http.delete(`/cards/${id}`)
  }

  return { list, fetchList, openByTitle, updateCard, removeCard }
})

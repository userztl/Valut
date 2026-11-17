import { defineStore } from 'pinia'
import { ref } from 'vue'
import http from '@/api/http'

export interface CanvasNodeRow {
  node_key: string
  card_id: number | null
  label: string
  x: number
  y: number
  card_title: string | null
  card_content: string | null
  card_color: string | null
}

export interface CanvasEdgeRow {
  source_key: string
  target_key: string
  label: string
}

/**
 * 画布状态：快照按画布条目加载与整体保存
 */
export const useCanvasStore = defineStore('canvas', () => {
  const nodes = ref<CanvasNodeRow[]>([])
  const edges = ref<CanvasEdgeRow[]>([])

  /** 拉取指定画布的快照 */
  async function fetchSnapshot(canvasId: number) {
    const data = await http.get(`/canvas/${canvasId}`)
    nodes.value = data.nodes || []
    edges.value = data.edges || []
  }

  /** 保存画布快照（整体覆盖，事务写入） */
  async function saveSnapshot(canvasId: number, snapshot: { nodes: Array<Object>; edges: Array<Object> }) {
    await http.put(`/canvas/${canvasId}`, snapshot)
  }

  return { nodes, edges, fetchSnapshot, saveSnapshot }
})

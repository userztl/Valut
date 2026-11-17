import { ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { useEditorStore } from '@/stores/editor'
import { useUiStore } from '@/stores/ui'

/**
 * 同名自动编号：已存在则追加 “ 1”“ 2”…，避免大量重复名称
 */
export function uniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base
  let i = 1
  while (existing.includes(`${base} ${i}`)) i++
  return `${base} ${i}`
}

/**
 * 创建文档/画布的共享入口：命名弹窗 → 同名去重 → 创建 → 激活并跳转对应视图
 * 返回新条目 ID，用户取消弹窗时返回 null
 */
export function useCreate() {
  const editorStore = useEditorStore()
  const ui = useUiStore()
  const router = useRouter()

  async function createItem(type: 'doc' | 'canvas', folderId: number | null = null): Promise<number | null> {
    let value: string
    try {
      ;({ value } = await ElMessageBox.prompt('名称', type === 'doc' ? '新建文档' : '新建画布', {
        inputValue: type === 'doc' ? '未命名文档' : '未命名画布'
      }))
    } catch {
      return null
    }
    const base = value.trim() || (type === 'doc' ? '未命名文档' : '未命名画布')
    const title = uniqueName(base, editorStore.items.map((x) => x.title))
    const { id } = await editorStore.createItem({ type, title, folder_id: folderId })
    await editorStore.fetchTree()
    const item = editorStore.items.find((x) => x.id === id)
    if (item) {
      ui.openItem(item)
      router.push(item.type === 'canvas' ? '/canvas' : '/doc')
    }
    return id
  }

  return { createItem }
}

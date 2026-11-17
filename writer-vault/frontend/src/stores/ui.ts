import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ItemType = 'doc' | 'canvas'

/** 全局字号档位：小 / 标准 / 大 */
export type FontSizeLevel = 'sm' | 'md' | 'lg'

/** localStorage 中持久化字号档位的键名 */
const FONT_SIZE_KEY = 'writer-vault-font-size'

/**
 * 全局 UI 状态：当前激活条目 + Inspector 开合 + 全局字号档位
 */
export const useUiStore = defineStore('ui', () => {
  const activeItemId = ref<number | null>(null)
  const activeType = ref<ItemType | null>(null)
  const activeTitle = ref('')
  const inspectorVisible = ref(false)
  const inspectorCardId = ref<number | null>(null)
  const sidebarCollapsed = ref(false)

  /** 当前全局字号档位，初始值从 localStorage 恢复，非法值回退为标准档 */
  const fontSizeLevel = ref<FontSizeLevel>(
    (['sm', 'md', 'lg'] as const).includes(
      localStorage.getItem(FONT_SIZE_KEY) as FontSizeLevel
    )
      ? (localStorage.getItem(FONT_SIZE_KEY) as FontSizeLevel)
      : 'md'
  )

  /**
   * 将当前字号档位写入 html 的 data-fs 属性，
   * 由 main.css 中的档位规则驱动 --font-scale，全局生效
   */
  function applyFontSize() {
    document.documentElement.dataset.fs = fontSizeLevel.value
  }

  /**
   * 切换全局字号档位：更新状态、持久化并立即应用到 DOM
   * @param level 目标档位（sm / md / lg）
   */
  function setFontSizeLevel(level: FontSizeLevel) {
    fontSizeLevel.value = level
    localStorage.setItem(FONT_SIZE_KEY, level)
    applyFontSize()
  }

  /**
   * 收起/展开左侧边栏
   */
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  /**
   * 激活左侧目录树中的条目（文档/画布）
   */
  function openItem(item: { id: number; type: ItemType; title: string }) {
    activeItemId.value = item.id
    activeType.value = item.type
    activeTitle.value = item.title
  }

  /**
   * 打开 Inspector 编辑指定卡片
   */
  function openInspectorCard(id: number) {
    inspectorCardId.value = id
    inspectorVisible.value = true
  }

  /**
   * 关闭 Inspector
   */
  function closeInspector() {
    inspectorVisible.value = false
    inspectorCardId.value = null
  }

  return {
    activeItemId, activeType, activeTitle,
    inspectorVisible, inspectorCardId,
    sidebarCollapsed, fontSizeLevel,
    openItem, openInspectorCard, closeInspector, toggleSidebar,
    applyFontSize, setFontSizeLevel
  }
})

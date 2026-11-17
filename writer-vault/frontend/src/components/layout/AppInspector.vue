<template>
  <aside class="inspector" :class="{ open: ui.inspectorVisible }">
    <template v-if="ui.inspectorVisible">
      <button class="inspector-close" @click="ui.closeInspector()">✕</button>
      <!-- 无边框超大标题 -->
      <input v-model="title" class="inspector-title" placeholder="标题" @input="scheduleSave" />
      <!-- 透明多行设定区，与面板融为一体 -->
      <textarea v-model="content" class="inspector-content scrollable" placeholder="记录详细设定……" @input="scheduleSave"></textarea>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useCardStore } from '@/stores/card'
import http from '@/api/http'

const ui = useUiStore()
const cardStore = useCardStore()
const title = ref('')
const content = ref('')
const saving = ref(false)

/**
 * Escape 键关闭 Inspector
 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && ui.inspectorVisible) ui.closeInspector()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

/**
 * 加载当前 Inspector 卡片内容
 */
watch(
  () => ui.inspectorCardId,
  async (id) => {
    if (!id) return
    const card = await http.get(`/cards/${id}`)
    title.value = card.title
    content.value = card.content
  },
  { immediate: true }
)

/**
 * 防抖保存卡片编辑
 */
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(doSave, 600)
}

/**
 * 执行保存并刷新卡片列表缓存
 */
async function doSave() {
  const id = ui.inspectorCardId
  if (!id || saving.value) return
  saving.value = true
  try {
    await cardStore.updateCard(id, { title: title.value, content: content.value })
    await cardStore.fetchList()
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* 默认宽度 0，滑出动画展开 */
.inspector {
  width: 0;
  min-width: 0;
  background: var(--bg-elevated);
  border-left: 1px solid var(--border-subtle);
  overflow: hidden;
  position: relative;
  transition: width var(--transition-slide);
  display: flex;
  flex-direction: column;
}
.inspector.open {
  width: var(--inspector-w);
  min-width: var(--inspector-w);
}
.inspector-close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-4);
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: var(--fs-body);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), background-color var(--transition-fast);
  z-index: 1;
}
.inspector-close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
/* 标题：无边框融入背景 + 极细底部分割线 */
.inspector-title {
  border: none;
  border-bottom: 1px solid var(--border-subtle);
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: clamp(18px, 1vw + 10px, 20px);
  font-weight: 700;
  padding: calc(var(--header-h)) var(--space-5) var(--space-3);
  margin: 0 var(--space-4);
  font-family: var(--font-sans);
}
.inspector-content {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: #cccccc;
  font-size: clamp(13px, 0.8vw + 6px, 14px);
  line-height: var(--lh-relaxed);
  padding: var(--space-4) var(--space-5) var(--space-5);
  font-family: var(--font-sans);
}
</style>

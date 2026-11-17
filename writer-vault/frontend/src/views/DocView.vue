<template>
  <div class="doc-view">
    <template v-if="ui.activeType === 'doc' && editorStore.current">
      <div class="doc-header">
        <el-input v-model="title" class="doc-title" placeholder="文档标题" @input="scheduleSave" />
      </div>
      <div class="editor-wrapper scrollable" @click.capture="onEditorClick">
        <editor-content :editor="editor" class="editor-body" />
      </div>
    </template>
    <HomeEmpty v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { WikiLink } from '@/components/editor/WikiLink'
import HomeEmpty from '@/components/common/HomeEmpty.vue'
import { useEditorStore } from '@/stores/editor'
import { useCardStore } from '@/stores/card'
import { useUiStore } from '@/stores/ui'

const editorStore = useEditorStore()
const cardStore = useCardStore()
const ui = useUiStore()
const title = ref('')

// 极简富文本：无复杂工具栏，[[双链]] 自动转换
const editor = useEditor({
  content: '',
  extensions: [StarterKit, WikiLink],
  editorProps: {
    attributes: { class: 'tiptap-body' }
  },
  onUpdate: () => scheduleSave()
})

/**
 * 加载激活文档：标题与正文同步到编辑器
 */
watch(
  () => ui.activeItemId,
  async (id) => {
    if (!id || ui.activeType !== 'doc') return
    await editorStore.fetchItem(id)
    const doc = editorStore.current
    if (!doc || !editor.value) return
    title.value = doc.title
    editor.value.commands.setContent(doc.content || '')
  },
  { immediate: true }
)

/**
 * 目录树重命名后同步标题输入框：store 中标题变化且与当前输入不一致时刷新，
 * 避免“树里改了名、编辑区仍是旧标题”
 */
watch(
  () => editorStore.items.find((x) => x.id === ui.activeItemId)?.title,
  (t) => {
    if (t && ui.activeType === 'doc' && t !== title.value) title.value = t
  }
)

/**
 * 编辑区点击：命中双链则打开卡片 Inspector；
 * 点击空白区域（非 ProseMirror 可编辑区）时聚焦编辑器，保证任意位置都能直接打字
 */
function onEditorClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const el = target.closest?.('.wiki-link') as HTMLElement | null
  const linkTitle = el?.getAttribute('data-wiki-title')
  if (linkTitle) {
    cardStore.openByTitle(linkTitle)
    return
  }
  if (editor.value && !target.closest('.ProseMirror')) {
    editor.value.commands.focus('end')
  }
}

// 编辑防抖保存（标题/正文一并提交，后端重建双链索引）
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(doSave, 800)
}

/**
 * 执行保存并刷新目录树标题
 */
async function doSave() {
  const id = ui.activeItemId
  if (!id || ui.activeType !== 'doc' || !editor.value) return
  await editorStore.saveItem(id, {
    title: title.value,
    content: editor.value.getHTML()
  })
  const item = editorStore.items.find((x) => x.id === id)
  if (item && item.title !== title.value) {
    item.title = title.value
    ui.activeTitle = title.value
  }
}

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
  editor.value?.destroy()
})
</script>

<style scoped>
.doc-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.doc-header {
  height: var(--header-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}
.doc-title :deep(.el-input__wrapper) {
  background: transparent;
  box-shadow: none;
  padding-left: 0;
}
.doc-title :deep(.el-input__inner) {
  font-size: var(--fs-title);
  font-weight: 700;
  color: var(--text-primary);
}
.editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-4) clamp(var(--space-4), 6vw, 96px);
  background: transparent;
  cursor: text;
}
/* 编辑器根容器撑满剩余高度，使可编辑区域覆盖整个正文区 */
.editor-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.editor-body :deep(.tiptap-body) {
  outline: none;
  flex: 1;
  font-size: var(--fs-doc);
  line-height: var(--lh-doc);
  color: var(--text-primary);
}

/* [[双链]] 标签样式：柔和蓝紫 Tag，底部虚线 */
.editor-body :deep(.wiki-link) {
  color: var(--primary-strong);
  background: var(--primary-bg);
  border-bottom: 1px dashed var(--primary);
  border-radius: var(--radius-sm);
  padding: 1px 4px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.editor-body :deep(.wiki-link:hover) {
  background: var(--primary-bg-hover);
}
</style>

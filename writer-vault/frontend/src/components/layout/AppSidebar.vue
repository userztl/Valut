<template>
  <aside
    ref="wrapRef"
    class="sidebar-wrap"
    :class="{ collapsed: ui.sidebarCollapsed }"
    @pointerdown="onSwipeStart"
    @pointermove="onSwipeMove"
    @pointerup="onSwipeEnd"
    @pointercancel="onSwipeCancel"
  >
    <div class="sidebar">
      <!-- 上半部分：目录树（高度可拖拽调整） -->
      <div class="sidebar-section" :style="{ flex: `0 0 ${treePercent}` }">
        <div class="sidebar-header">
          <span class="sidebar-caption">目录大纲</span>
          <div class="sidebar-actions">
            <el-tooltip content="新建目录" placement="bottom">
              <el-button text size="small" @click="addFolder()"><el-icon><FolderAdd /></el-icon></el-button>
            </el-tooltip>
            <el-tooltip content="收起侧栏" placement="bottom">
              <el-button text size="small" @click="ui.toggleSidebar()"><el-icon><Fold /></el-icon></el-button>
            </el-tooltip>
          </div>
        </div>
        <div class="tree-list scrollable" @dragover="onTreeDragOver" @drop="onTreeDrop">
          <div
            v-for="node in flatTree"
            :key="node.key"
            class="tree-node"
            :class="[
              node.kind,
              {
                active: isActive(node),
                child: node.depth > 0,
                dragging: dragNode?.key === node.key,
                'drop-into': dropHint?.key === node.key && dropHint.pos === 'into',
                'drop-before': dropHint?.key === node.key && dropHint.pos === 'before',
                'drop-after': dropHint?.key === node.key && dropHint.pos === 'after'
              }
            ]"
            :style="{ paddingLeft: `calc(${node.depth} * 20px + var(--space-2))`, '--d': node.depth }"
            draggable="true"
            @click="onNodeClick(node)"
            @contextmenu.prevent="openNodeCtx($event, node)"
            @dragstart="onNodeDragStart(node, $event)"
            @dragend="onNodeDragEnd"
            @dragover="onNodeDragOver(node, $event)"
            @dragleave="onNodeDragLeave(node)"
            @drop="onNodeDrop(node, $event)"
          >
            <!-- 层级引导竖线：每个祖先层级一条 -->
            <span
              v-for="g in node.depth"
              :key="`g${g}`"
              class="tree-guide"
              :style="{ left: `${(g - 1) * 20 + 12}px` }"
            ></span>

            <!-- 目录：展开/折叠箭头 -->
            <el-icon
              v-if="node.kind === 'folder'"
              class="tree-caret"
              :class="{ open: isExpanded(node.id) }"
              @click.stop="toggleExpand(node.id)"
            >
              <CaretRight />
            </el-icon>
            <span v-else class="tree-caret-placeholder"></span>

            <el-icon class="tree-icon">
              <FolderOpened v-if="node.kind === 'folder' && isExpanded(node.id)" />
              <Folder v-else-if="node.kind === 'folder'" />
              <Document v-else-if="node.kind === 'doc'" />
              <Picture v-else />
            </el-icon>
            <span class="tree-label" :title="node.label">{{ node.label }}</span>

            <!-- 节点悬停操作菜单：新建 / 重命名 / 删除 -->
            <el-dropdown
              trigger="click"
              placement="bottom-end"
              class="tree-more"
              @command="(cmd: string) => onNodeCmd(cmd, node)"
            >
              <span class="tree-more-btn" @click.stop><el-icon><MoreFilled /></el-icon></span>
              <template #dropdown>
                <el-dropdown-menu>
                  <template v-if="node.kind === 'folder'">
                    <el-dropdown-item command="newFolder">新建子目录</el-dropdown-item>
                    <el-dropdown-item command="newDoc">在此新建文档</el-dropdown-item>
                    <el-dropdown-item command="newCanvas">在此新建画布</el-dropdown-item>
                  </template>
                  <el-dropdown-item command="rename">重命名</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div v-if="!flatTree.length" class="tree-empty">暂无内容，点击右上角图标新建</div>
        </div>
      </div>

      <!-- 可拖拽分割条：调整目录/卡片两区高度 -->
      <div class="sidebar-splitter" title="拖拽调整区域高度" @mousedown="startSplitDrag"></div>

      <!-- 下半部分：全局卡片库 -->
      <div class="sidebar-section sidebar-cards">
        <div class="sidebar-header">
          <span class="sidebar-caption">实体库（拖拽）</span>
          <div class="sidebar-actions">
            <el-tooltip content="新建卡片" placement="bottom">
              <el-button text size="small" @click="addCard"><el-icon><Plus /></el-icon></el-button>
            </el-tooltip>
          </div>
        </div>
        <div class="card-search">
          <el-input v-model="keyword" placeholder="搜索卡片库" :prefix-icon="Search" clearable />
        </div>
        <div class="card-list scrollable">
          <div
            v-for="card in cardStore.list"
            :key="card.id"
            class="entity-card"
            :class="{ dragging: draggingCardId === card.id }"
            :style="{ '--card-color': card.color }"
            draggable="true"
            @dragstart="onCardDragStart(card, $event)"
            @dragend="draggingCardId = null"
            @click="onCardClick(card.id)"
            @contextmenu.prevent="openCardCtx($event, card)"
          >
            {{ card.title }}
          </div>
          <div v-if="!cardStore.list.length" class="card-empty">暂无卡片，点击 + 新建</div>
        </div>
      </div>
    </div>

    <!-- 左滑拖拽视觉反馈：半透明遮罩 + 箭头渐强，达标后提示松开 -->
    <div v-show="swipeHint.active" class="swipe-overlay" :style="{ opacity: 0.25 + swipeHint.progress * 0.75 }">
      <el-icon class="swipe-arrow" :class="{ ready: swipeHint.progress >= 1 }"><DArrowLeft /></el-icon>
      <span class="swipe-text">{{ swipeHint.progress >= 1 ? '松开收起侧栏' : '继续左滑' }}</span>
    </div>

    <!-- 目录树右键菜单：新增 / 重命名 / 删除 -->
    <div v-if="nodeCtx.visible" class="tree-ctx-menu" :style="{ left: `${nodeCtx.x}px`, top: `${nodeCtx.y}px` }">
      <template v-if="nodeCtx.node && nodeCtx.node.kind === 'folder'">
        <div class="tree-ctx-item" @click="nodeCmd('newFolder')">新建子目录</div>
        <div class="tree-ctx-item" @click="nodeCmd('newDoc')">在此新建文档</div>
        <div class="tree-ctx-item" @click="nodeCmd('newCanvas')">在此新建画布</div>
        <div class="tree-ctx-sep"></div>
      </template>
      <div class="tree-ctx-item" @click="nodeCmd('rename')">重命名</div>
      <div class="tree-ctx-item danger" @click="nodeCmd('delete')">删除</div>
    </div>

    <!-- 卡片右键菜单：二级结构，悬停/点击“标签颜色”再展开调色盘 -->
    <div
      v-if="cardCtx.visible"
      class="tree-ctx-menu card-ctx-menu"
      :style="{ left: `${cardCtx.x}px`, top: `${cardCtx.y}px` }"
      @click.stop
      @mouseleave="paletteOpen = false"
    >
      <div class="tree-ctx-item submenu-item" @mouseenter="paletteOpen = true" @click="paletteOpen = !paletteOpen">
        <span>标签颜色</span>
        <el-icon class="submenu-arrow"><CaretRight /></el-icon>
      </div>
      <div v-show="paletteOpen" class="palette-flyout">
        <div class="color-row">
          <button
            v-for="c in CARD_COLORS"
            :key="c"
            class="color-dot"
            :class="{ active: cardCtx.card?.color === c }"
            :style="{ background: c }"
            :title="c"
            @click="setCardColor(c)"
          ></button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import {
  Folder, FolderOpened, Document, Picture, FolderAdd,
  Search, Plus, Fold, CaretRight, MoreFilled, DArrowLeft
} from '@element-plus/icons-vue'
import { useEditorStore } from '@/stores/editor'
import { useCardStore, type CardEntity } from '@/stores/card'
import { useUiStore } from '@/stores/ui'
import { uniqueName, useCreate } from '@/composables/useCreate'
import http from '@/api/http'

const editorStore = useEditorStore()
const cardStore = useCardStore()
const ui = useUiStore()
const router = useRouter()
const { createItem: createItemFlow } = useCreate()
const keyword = ref('')

const wrapRef = ref<HTMLElement | null>(null)
const treeRatio = ref(0.55)
const treePercent = computed(() => `${(treeRatio.value * 100).toFixed(1)}%`)

interface FlatNode {
  key: string
  kind: 'folder' | 'doc' | 'canvas'
  id: number
  label: string
  depth: number
}

// 目录展开状态：默认全部展开（未显式折叠过的目录都展开）
const expandedMap = reactive<Record<number, boolean>>({})

/**
 * 目录是否处于展开状态
 */
function isExpanded(id: number) {
  return expandedMap[id] !== false
}

/**
 * 切换目录展开/折叠
 */
function toggleExpand(id: number) {
  expandedMap[id] = !isExpanded(id)
}

// 新建目录/加载树后默认展开新目录
watch(
  () => editorStore.folders.length,
  () => {
    for (const f of editorStore.folders) {
      if (!(f.id in expandedMap)) expandedMap[f.id] = true
    }
  },
  { immediate: true }
)

/**
 * 组装扁平化目录树：同级先目录后条目；折叠的目录隐藏子级
 */
const flatTree = computed<FlatNode[]>(() => {
  const nodes: FlatNode[] = []
  const pushItems = (folderId: number | null, depth: number) => {
    for (const it of editorStore.items.filter((x) => (x.folder_id ?? null) === folderId)) {
      nodes.push({ key: `i${it.id}`, kind: it.type, id: it.id, label: it.title, depth })
    }
  }
  const walk = (parentId: number | null, depth: number) => {
    for (const f of editorStore.folders.filter((x) => (x.parent_id ?? null) === parentId)) {
      nodes.push({ key: `f${f.id}`, kind: 'folder', id: f.id, label: f.name, depth })
      if (isExpanded(f.id)) {
        pushItems(f.id, depth + 1)
        walk(f.id, depth + 1)
      }
    }
  }
  // 根级：先目录（含各自子级），后根条目
  walk(null, 0)
  pushItems(null, 0)
  return nodes
})

/**
 * 判断节点是否为当前激活条目
 */
function isActive(node: FlatNode) {
  return node.kind !== 'folder' && ui.activeItemId === node.id
}

/**
 * 节点点击：目录切换展开；条目激活并跳转对应视图（文档/画布）
 */
function onNodeClick(node: FlatNode) {
  if (node.kind === 'folder') {
    toggleExpand(node.id)
    return
  }
  const item = editorStore.items.find((x) => x.id === node.id)
  if (!item) return
  ui.openItem(item)
  router.push(item.type === 'canvas' ? '/canvas' : '/doc')
}

/**
 * 节点操作菜单命令分发
 */
function onNodeCmd(cmd: string, node: FlatNode) {
  if (cmd === 'newFolder') addFolder(node.id)
  else if (cmd === 'newDoc') addItemIn('doc', node.id)
  else if (cmd === 'newCanvas') addItemIn('canvas', node.id)
  else if (cmd === 'rename') renameNode(node)
  else if (cmd === 'delete') deleteNode(node)
}

/**
 * 重命名节点：目录改 name，条目改 title，当前激活条目同步顶栏
 */
async function renameNode(node: FlatNode) {
  const isFolder = node.kind === 'folder'
  let value: string
  try {
    ({ value } = await ElMessageBox.prompt('新名称', isFolder ? '重命名目录' : '重命名', {
      inputValue: node.label
    }))
  } catch {
    return
  }
  const name = value.trim()
  if (!name) return
  if (isFolder) {
    await http.put(`/folders/${node.id}`, { name })
  } else {
    await editorStore.saveItem(node.id, { title: name })
    if (ui.activeItemId === node.id) ui.activeTitle = name
  }
  await editorStore.fetchTree()
}

/**
 * 删除节点：目录连同其下内容级联删除；删除当前激活条目后回到空态
 */
async function deleteNode(node: FlatNode) {
  const isFolder = node.kind === 'folder'
  try {
    await ElMessageBox.confirm(
      isFolder
        ? `删除目录「${node.label}」及其下全部内容，不可恢复，确认删除？`
        : `删除「${node.label}」，不可恢复，确认删除？`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  if (isFolder) {
    await http.delete(`/folders/${node.id}`)
  } else {
    await editorStore.removeItem(node.id)
    if (ui.activeItemId === node.id) {
      ui.activeItemId = null
      ui.activeType = null
      ui.activeTitle = ''
    }
  }
  await editorStore.fetchTree()
}

/**
 * 新建目录：parentId 为空建在根下，否则建为指定目录的子目录
 * @param parentId 父目录 ID（null=根目录）
 */
async function addFolder(parentId: number | null = null) {
  let value: string
  try {
    ;({ value } = await ElMessageBox.prompt('目录名称', parentId ? '新建子目录' : '新建目录', {
      inputValue: '新建目录'
    }))
  } catch {
    return
  }
  const name = uniqueName(value.trim() || '新建目录', editorStore.folders.map((f) => f.name))
  await http.post('/folders', { name, parent_id: parentId })
  if (parentId) expandedMap[parentId] = true
  await editorStore.fetchTree()
}

/**
 * 在指定目录下新建条目：层级归属一目了然（右键菜单 / ⋯ 菜单入口）
 */
async function addItemIn(type: 'doc' | 'canvas', folderId: number) {
  const id = await createItemFlow(type, folderId)
  if (id !== null) expandedMap[folderId] = true
}

/**
 * 卡片标签调色板：新建卡片按“使用次数最少”轮换取色，保证颜色区分
 */
const CARD_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

function nextCardColor(): string {
  const counts = new Map<string, number>()
  for (const c of cardStore.list) counts.set(c.color, (counts.get(c.color) || 0) + 1)
  let best = CARD_COLORS[0]
  let min = Infinity
  for (const col of CARD_COLORS) {
    const n = counts.get(col) || 0
    if (n < min) {
      min = n
      best = col
    }
  }
  return best
}

/**
 * 新建卡片并刷新列表：颜色本地轮换，不与现有卡片同色
 */
async function addCard() {
  const { value } = await ElMessageBox.prompt('卡片标题', '新建卡片', { inputValue: '新卡片' })
  const title = uniqueName(value.trim() || '新卡片', cardStore.list.map((c) => c.title))
  await http.post('/cards', { title, color: nextCardColor() })
  await cardStore.fetchList(keyword.value.trim() || undefined)
}

/**
 * 卡片点击：已打开同一卡片则关闭 Inspector（再点一次即收起）
 */
function onCardClick(id: number) {
  if (ui.inspectorVisible && ui.inspectorCardId === id) ui.closeInspector()
  else ui.openInspectorCard(id)
}

// 拖拽中的卡片：幽灵态半透明反馈
const draggingCardId = ref<number | null>(null)

/**
 * 卡片拖拽开始：向 dataTransfer 写入卡片信息，供画布落点创建节点
 */
function onCardDragStart(card: { id: number; title: string; content: string; color: string }, e: DragEvent) {
  draggingCardId.value = card.id
  e.dataTransfer?.setData('application/x-card', JSON.stringify(card))
}

// ---------- 目录树拖拽：改变层级归属与同级排序 ----------
const dragNode = ref<FlatNode | null>(null)
const dropHint = ref<{ key: string; pos: 'into' | 'before' | 'after' } | null>(null)

/**
 * 判断目录 targetId 是否为目录 ancestorId 的后代（含自身），用于阻止成环拖拽
 * @param targetId 待检查目录 ID
 * @param ancestorId 疑似祖先目录 ID
 * @returns 是否为其后代或自身
 */
function isFolderDescendant(targetId: number, ancestorId: number): boolean {
  let cursor: number | null = targetId
  while (cursor !== null) {
    if (cursor === ancestorId) return true
    const f = editorStore.folders.find((x) => x.id === cursor)
    cursor = f ? f.parent_id ?? null : null
  }
  return false
}

/**
 * 节点所属父目录 ID：目录取 parent_id，条目取 folder_id，根为 null
 */
function parentOf(node: FlatNode): number | null {
  if (node.kind === 'folder') return editorStore.folders.find((f) => f.id === node.id)?.parent_id ?? null
  return editorStore.items.find((i) => i.id === node.id)?.folder_id ?? null
}

/**
 * 取指定父级下同类型兄弟节点，按 sort、id 升序（与后端排序一致）
 */
function siblingsOf(kind: FlatNode['kind'], parentId: number | null) {
  const bySort = (a: { sort: number; id: number }, b: { sort: number; id: number }) => a.sort - b.sort || a.id - b.id
  if (kind === 'folder') {
    return editorStore.folders.filter((f) => (f.parent_id ?? null) === parentId).slice().sort(bySort)
  }
  return editorStore.items
    .filter((i) => (i.folder_id ?? null) === parentId && i.type === kind)
    .slice()
    .sort(bySort)
}

/**
 * 持久化一次移动：更新父级归属与排序权重
 * @param node 被移动节点
 * @param parentId 目标父目录 ID（null=根）
 * @param sort 新排序权重
 */
function persistMove(node: FlatNode, parentId: number | null, sort: number) {
  return node.kind === 'folder'
    ? http.put(`/folders/${node.id}`, { parent_id: parentId, sort })
    : editorStore.saveItem(node.id, { folder_id: parentId, sort })
}

/**
 * 同级重排：按新顺序以 10 为间隔写回 sort（预留插入空间），仅提交发生变化的节点
 * @param dragged 被拖节点
 * @param ordered 重排后的同级序列（含占位的被拖节点）
 * @param parentId 目标父目录 ID
 */
async function resequence(dragged: FlatNode, ordered: Array<{ id: number; sort: number }>, parentId: number | null) {
  const tasks: Promise<unknown>[] = []
  ordered.forEach((s, i) => {
    const sort = i * 10
    if (s.id === dragged.id) {
      tasks.push(persistMove(dragged, parentId, sort))
    } else if (s.sort !== sort) {
      tasks.push(
        dragged.kind === 'folder' ? http.put(`/folders/${s.id}`, { sort }) : editorStore.saveItem(s.id, { sort })
      )
    }
  })
  await Promise.all(tasks)
}

/**
 * 拖拽开始：记录被拖节点并写入拖拽标记
 */
function onNodeDragStart(node: FlatNode, e: DragEvent) {
  dragNode.value = node
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-tree', `${node.kind}:${node.id}`)
  }
}

/**
 * 拖拽结束：清理拖拽状态与落点提示
 */
function onNodeDragEnd() {
  dragNode.value = null
  dropHint.value = null
}

/**
 * 节点 dragover：目录中段=移入，上下边缘=前/后插入；自身/后代等非法目标不响应
 */
function onNodeDragOver(node: FlatNode, e: DragEvent) {
  const d = dragNode.value
  if (!d) return
  if (d.kind === node.kind && d.id === node.id) return
  if (d.kind === 'folder' && node.kind === 'folder' && isFolderDescendant(node.id, d.id)) return
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const offset = e.clientY - rect.top
  const pos =
    node.kind === 'folder' && offset > rect.height * 0.25 && offset < rect.height * 0.75
      ? 'into'
      : offset < rect.height / 2
        ? 'before'
        : 'after'
  dropHint.value = { key: node.key, pos }
}

/**
 * 节点 dragleave：仅清除本节点的提示，避免子元素冒泡抖动
 */
function onNodeDragLeave(node: FlatNode) {
  if (dropHint.value?.key === node.key) dropHint.value = null
}

/**
 * 节点 drop：校验落点仍在本节点后执行移动
 */
function onNodeDrop(node: FlatNode, e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  const d = dragNode.value
  const hint = dropHint.value
  dragNode.value = null
  dropHint.value = null
  if (!d || !hint || hint.key !== node.key) return
  void moveNode(d, node, hint.pos)
}

/**
 * 根级 dragover：允许落在树列表空白区域
 */
function onTreeDragOver(e: DragEvent) {
  if (dragNode.value) e.preventDefault()
}

/**
 * 根级 drop：未被节点拦截的拖拽落到空白区，移入根目录末尾
 */
async function onTreeDrop(e: DragEvent) {
  const d = dragNode.value
  if (!d) return
  e.preventDefault()
  dragNode.value = null
  dropHint.value = null
  const list = siblingsOf(d.kind, null).filter((x) => x.id !== d.id)
  await persistMove(d, null, list.length * 10)
  await editorStore.fetchTree()
}

/**
 * 执行拖拽移动：into=移入目标目录末尾；before/after=移入目标所在父级并精确插位
 * @param d 被拖节点
 * @param target 落点节点
 * @param pos 落点位置（into / before / after）
 */
async function moveNode(d: FlatNode, target: FlatNode, pos: 'into' | 'before' | 'after') {
  const parentId = pos === 'into' && target.kind === 'folder' ? target.id : parentOf(target)
  // 防成环：目录不能移入自身或后代
  if (d.kind === 'folder' && parentId !== null && (parentId === d.id || isFolderDescendant(parentId, d.id))) return
  const list = siblingsOf(d.kind, parentId).filter((x) => x.id !== d.id) as Array<{ id: number; sort: number }>
  if (d.kind === target.kind && pos !== 'into') {
    const idx = list.findIndex((x) => x.id === target.id)
    if (idx === -1) return
    list.splice(pos === 'before' ? idx : idx + 1, 0, { id: d.id, sort: -1 })
    await resequence(d, list, parentId)
  } else {
    await persistMove(d, parentId, list.length * 10)
  }
  await editorStore.fetchTree()
}

/**
 * 分割条拖拽：调整目录区/卡片区高度比例（20%~80%）
 */
function startSplitDrag(e: MouseEvent) {
  e.preventDefault()
  const move = (ev: MouseEvent) => {
    const el = wrapRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    treeRatio.value = Math.min(0.8, Math.max(0.2, (ev.clientY - rect.top) / rect.height))
  }
  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

// ---------- 目录树右键菜单 ----------
const nodeCtx = reactive({ visible: false, x: 0, y: 0, node: null as FlatNode | null })

/**
 * 右键打开节点菜单：定位鼠标处并防止越界
 */
function openNodeCtx(e: MouseEvent, node: FlatNode) {
  cardCtx.visible = false
  nodeCtx.node = node
  nodeCtx.x = Math.min(e.clientX, window.innerWidth - 170)
  nodeCtx.y = Math.min(e.clientY, window.innerHeight - 200)
  nodeCtx.visible = true
}

/**
 * 菜单命令分发：关闭菜单后复用 ⋯ 菜单逻辑
 */
function nodeCmd(cmd: string) {
  const node = nodeCtx.node
  nodeCtx.visible = false
  if (node) onNodeCmd(cmd, node)
}

function closeNodeCtx() {
  nodeCtx.visible = false
}

// ---------- 卡片右键菜单：标签颜色 ----------
const cardCtx = reactive({ visible: false, x: 0, y: 0, card: null as CardEntity | null })
// 二级调色盘浮层：悬停/点击“标签颜色”后展开
const paletteOpen = ref(false)

/**
 * 右键打开卡片菜单：与节点菜单互斥，调色盘默认收起
 */
function openCardCtx(e: MouseEvent, card: CardEntity) {
  nodeCtx.visible = false
  paletteOpen.value = false
  cardCtx.card = card
  cardCtx.x = Math.min(e.clientX, window.innerWidth - 190)
  cardCtx.y = Math.min(e.clientY, window.innerHeight - 120)
  cardCtx.visible = true
}

/**
 * 切换卡片标签颜色：写库后刷新列表，画布节点由既有 watch 自动同步
 */
async function setCardColor(color: string) {
  if (!cardCtx.card || cardCtx.card.color === color) {
    cardCtx.visible = false
    return
  }
  await cardStore.updateCard(cardCtx.card.id, { color })
  await cardStore.fetchList(keyword.value.trim() || undefined)
  cardCtx.visible = false
}

function closeAllCtx() {
  nodeCtx.visible = false
  cardCtx.visible = false
}

function onCtxKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeAllCtx()
}

// ---------- 滑动手势：左滑收缩侧栏（触摸滑动 / 鼠标拖拽均生效） ----------
let swipeTracking = false
let swipeStartX = 0
let swipeStartY = 0

// 拖拽进度反馈：active 控制遮罩显隐，progress(0~1) 驱动渐强与达标态
const swipeHint = reactive({ active: false, progress: 0 })

/**
 * 收起手势触发阈值：鼠标拖拽需要更长位移
 */
function swipeThreshold(pointerType: string) {
  return pointerType === 'mouse' ? 100 : 60
}

/**
 * 手势起点：排除分割条、按钮、输入框、下拉与右键菜单等自带交互语义的区域
 */
function onSwipeStart(e: PointerEvent) {
  const t = e.target as HTMLElement
  swipeTracking = !t.closest('.sidebar-splitter, button, input, .el-dropdown, .tree-ctx-menu')
  if (!swipeTracking) return
  swipeStartX = e.clientX
  swipeStartY = e.clientY
  swipeHint.active = false
  swipeHint.progress = 0
}

/**
 * 拖拽过程：横向左移且主导纵向时显示遮罩，progress 随距离渐增至达标
 */
function onSwipeMove(e: PointerEvent) {
  if (!swipeTracking) return
  const dx = swipeStartX - e.clientX
  const dy = Math.abs(e.clientY - swipeStartY)
  if (dx <= 0 || dx < dy * 1.5) {
    swipeHint.active = false
    swipeHint.progress = 0
    return
  }
  swipeHint.active = true
  swipeHint.progress = Math.min(1, dx / swipeThreshold(e.pointerType))
}

/**
 * 手势判定：左滑达到阈值时收起侧栏，并复位反馈遮罩
 */
function onSwipeEnd(e: PointerEvent) {
  if (!swipeTracking) return
  swipeTracking = false
  const reached = swipeHint.progress >= 1
  swipeHint.active = false
  swipeHint.progress = 0
  if (reached && !ui.sidebarCollapsed) ui.toggleSidebar()
}

function onSwipeCancel() {
  swipeTracking = false
  swipeHint.active = false
  swipeHint.progress = 0
}

// 搜索防抖
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, (kw) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => cardStore.fetchList(kw.trim() || undefined), 300)
})

onMounted(async () => {
  window.addEventListener('click', closeAllCtx)
  window.addEventListener('keydown', onCtxKeydown)
  await Promise.all([editorStore.fetchTree(), cardStore.fetchList()])
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeAllCtx)
  window.removeEventListener('keydown', onCtxKeydown)
})
</script>

<style scoped>
/* 外层容器负责宽度收展动画；内层固定宽度防止内容被压扁 */
.sidebar-wrap {
  position: relative;
  width: var(--sidebar-w);
  min-width: 0;
  flex-shrink: 0;
  transition: width var(--transition-slide);
  overflow: hidden;
}
.sidebar-wrap.collapsed {
  width: 0;
}
.sidebar {
  width: var(--sidebar-w);
  height: 100%;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sidebar-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.sidebar-cards {
  flex: 1;
}
.sidebar-header {
  height: var(--header-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-2) 0 var(--space-3);
}
.sidebar-caption {
  font-size: var(--fs-caption);
  color: var(--text-tertiary);
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.sidebar-actions {
  display: flex;
  align-items: center;
}
.sidebar-actions .el-button {
  color: var(--text-secondary);
  transition: color var(--transition-fast), background-color var(--transition-fast);
}
.sidebar-actions .el-button:hover {
  color: var(--primary-strong);
  background: var(--bg-hover);
}
/* 新建文本/画布按钮：更醒目 */
.sidebar-actions .el-button.prominent {
  color: var(--primary-strong);
}

/* 分割条：悬停高亮提示可拖拽 */
.sidebar-splitter {
  height: 5px;
  flex-shrink: 0;
  cursor: row-resize;
  border-top: 1px solid var(--border-subtle);
  transition: background-color var(--transition-fast);
}
.sidebar-splitter:hover {
  background: var(--primary-bg);
}

/* 目录树：圆角行卡片式布局，行间距 + 悬浮渐显，层级一眼可辨 */
.tree-list {
  flex: 1;
  padding: 4px 8px var(--space-2);
}
.tree-node {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: clamp(28px, 4vh, 32px);
  margin-bottom: 2px;
  padding-right: var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-secondary);
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
/* 层级引导竖线（祖先列）+ 横向连接线（├ 形），层级关系一眼可辨 */
.tree-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.09);
  pointer-events: none;
}
.tree-node.child::before {
  content: '';
  position: absolute;
  top: 50%;
  left: calc((var(--d) - 1) * 20px + 12px);
  width: 16px;
  height: 1px;
  background: rgba(255, 255, 255, 0.09);
  pointer-events: none;
}
/* 目录行分组底色：与子条目形成区块对比 */
.tree-node.folder {
  background: rgba(92, 107, 192, 0.05);
}
.tree-node:hover {
  background: var(--bg-hover);
}
.tree-node.active {
  background: var(--bg-selected);
  color: #ffffff;
}
/* 选中态：左侧 3px 主题高亮竖条（内嵌圆角） */
.tree-node.active::after {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  background: var(--primary);
  border-radius: 0 2px 2px 0;
}
/* 选中态：文字加粗高亮，图标用主题色 */
.tree-node.active .tree-label {
  color: var(--text-primary);
  font-weight: 600;
}
.tree-node.active .tree-icon {
  color: var(--primary);
}
/* 目录行视觉强化：加粗 + 主文字色 */
.tree-node.folder .tree-label {
  color: var(--text-primary);
  font-weight: 600;
}
/* 拖拽反馈：拖拽源半透明；目录中段高亮=移入；上下边缘插入线 */
.tree-node.dragging {
  opacity: 0.45;
}
.tree-node.drop-into {
  background: var(--primary-bg);
  box-shadow: inset 0 0 0 1px var(--primary);
}
.tree-node.drop-before {
  box-shadow: inset 0 2px 0 var(--primary-strong);
}
.tree-node.drop-after {
  box-shadow: inset 0 -2px 0 var(--primary-strong);
}
.tree-icon {
  font-size: var(--fs-body);
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.tree-node.folder .tree-icon {
  color: var(--text-secondary);
}
/* 展开/折叠箭头 */
.tree-caret {
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}
.tree-caret:hover {
  color: var(--text-primary);
}
.tree-caret.open {
  transform: rotate(90deg);
}
.tree-caret-placeholder {
  width: 12px;
  flex-shrink: 0;
}
/* 节点悬停操作：默认隐藏，行悬浮时渐显 */
.tree-more {
  margin-left: auto;
  opacity: 0;
  flex-shrink: 0;
  transition: opacity var(--transition-fast);
}
.tree-node:hover .tree-more,
.tree-more:focus-within {
  opacity: 1;
}
.tree-more-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  outline: none;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}
.tree-more-btn:hover {
  color: var(--text-primary);
  background: var(--bg-selected);
}
.tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-body);
}
.tree-empty {
  padding: var(--space-3);
  color: var(--text-tertiary);
  font-size: var(--fs-caption);
  text-align: center;
}

/* 卡片库 */
.card-search {
  padding: var(--space-2) var(--space-3);
  flex-shrink: 0;
}
/* 搜索框：内凹深底 + 极细暗边框，聚焦亮起主题描边与光晕 */
.card-search :deep(.el-input__wrapper) {
  background: var(--bg-base);
  box-shadow: 0 0 0 1px var(--border-subtle) inset;
  border-radius: 6px;
  transition: box-shadow var(--transition-fast);
}
.card-search :deep(.el-input__inner) {
  font-size: 13px;
}
.card-search :deep(.el-input__inner::placeholder) {
  color: #555;
}
.card-search :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px var(--primary) inset,
    0 0 0 2px rgba(92, 107, 192, 0.2);
}
.card-list {
  flex: 1;
  padding: 0 var(--space-3) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* 卡片：实物感——深底、圆角、边框、左侧颜色条（::before 不占内容宽度） */
.entity-card {
  position: relative;
  overflow: hidden;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: grab;
  user-select: none;
  transition:
    transform 0.1s ease,
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.entity-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: var(--card-color, var(--primary));
}
.entity-card:hover {
  transform: translateY(-1px);
  background: var(--bg-hover);
  border-color: #444;
  box-shadow: 0 0 0 1px rgba(92, 107, 192, 0.25), var(--shadow-card);
}
.entity-card:active {
  cursor: grabbing;
  transform: scale(0.98);
}
/* 拖拽幽灵态：半透明 + 主题色虚线框 */
.entity-card.dragging {
  opacity: 0.5;
  border: 1px dashed var(--primary);
}
.card-empty {
  padding: var(--space-3);
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--fs-caption);
}

/* 左滑拖拽反馈遮罩：半透明蓝紫渐变 + 居中箭头，pointer-events 关闭不拦截手势 */
.swipe-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  background: linear-gradient(270deg, rgba(20, 20, 20, 0.35), rgba(92, 107, 192, 0.18));
  backdrop-filter: blur(1px);
  pointer-events: none;
  transition: opacity var(--transition-fast);
}
.swipe-arrow {
  font-size: clamp(28px, 4vh, 40px);
  color: var(--text-secondary);
  transition: color var(--transition-fast), transform var(--transition-fast);
}
.swipe-arrow.ready {
  color: var(--primary-strong);
  transform: translateX(-6px);
}
.swipe-text {
  font-size: var(--fs-caption);
  color: var(--text-secondary);
}
.swipe-arrow.ready + .swipe-text,
.swipe-overlay:has(.swipe-arrow.ready) .swipe-text {
  color: var(--primary-strong);
}

/* 目录树右键菜单 */
.tree-ctx-menu {
  position: fixed;
  z-index: 100;
  min-width: 156px;
  padding: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card-drag);
}
.tree-ctx-item {
  padding: 7px 10px;
  font-size: var(--fs-caption);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.tree-ctx-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.tree-ctx-item.danger:hover {
  color: #e57373;
}
.tree-ctx-sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--border-subtle);
}

/* 卡片颜色二级菜单：触发项 + 右侧展开的调色盘浮层 */
.submenu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.submenu-arrow {
  font-size: 10px;
  color: var(--text-tertiary);
}
.palette-flyout {
  position: absolute;
  left: calc(100% + 4px);
  top: -5px;
  padding: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card-drag);
}
.color-row {
  display: grid;
  grid-template-columns: repeat(4, 18px);
  gap: 10px;
  width: max-content;
}
.color-dot {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.color-dot:hover {
  transform: scale(1.2);
}
.color-dot.active {
  box-shadow: 0 0 0 2px var(--bg-elevated), 0 0 0 3px var(--text-primary);
}
</style>

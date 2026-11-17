<template>
  <div
    v-if="ui.activeType === 'canvas'"
    class="canvas-view"
    @dragover.prevent
    @drop="onDrop"
  >
    <div class="canvas-header">
      <span class="canvas-title">{{ ui.activeTitle }}</span>
      <div class="canvas-tools">
        <el-tooltip content="智能自动布局：按连线流向分层排列" placement="bottom">
          <el-button text size="small" class="tool-btn" :disabled="!nodes.length" @click="autoLayout">
            <el-icon><Grid /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="删除选中的节点与连线" placement="bottom">
          <el-button text size="small" class="tool-btn" :disabled="!hasSelection" @click="deleteSelection">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
        <span class="canvas-tip">拖卡片入画布 · 蓝点拖出连线 · 双击连线写关系</span>
      </div>
    </div>
    <div class="canvas-flow" :class="{ 'layout-animating': layoutAnimating }">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        fit-view-on-init
        :fit-view-options="{ padding: 0.2, maxZoom: 1 }"
        :max-zoom="1.5"
        :delete-key-code="['Backspace', 'Delete']"
        @connect="onConnect"
        @pane-click="ui.closeInspector()"
        @node-double-click="onNodeDoubleClick"
        @edge-double-click="onEdgeDoubleClick"
        @node-context-menu="onNodeCtx"
        @edge-context-menu="onEdgeCtx"
      >
        <!-- 卡片节点：标题栏 + 内容区（最多2行）+ 左右锚点；双击打开卡片详情 -->
        <template #node-card="nodeProps">
          <div
            class="canvas-card"
            :style="{ borderLeftColor: nodeProps.data.color || 'var(--primary)' }"
          >
            <div class="canvas-card-head">{{ nodeProps.data.label || nodeProps.data.cardTitle }}</div>
            <div class="canvas-card-body">{{ nodeProps.data.summary || '暂无设定' }}</div>
            <Handle type="target" position="left" class="canvas-handle" />
            <Handle type="source" position="right" class="canvas-anchor" />
          </div>
        </template>
      </VueFlow>
    </div>

    <!-- 画布右键菜单：节点/连线常用操作 -->
    <div v-if="ctx.visible" class="ctx-menu" :style="{ left: `${ctx.x}px`, top: `${ctx.y}px` }">
      <template v-if="ctx.kind === 'node'">
        <div class="ctx-item" @click="ctxOpenCard"><el-icon><Memo /></el-icon>打开卡片详情</div>
        <div class="ctx-item danger" @click="ctxDeleteNode"><el-icon><Delete /></el-icon>删除节点</div>
      </template>
      <template v-else>
        <div class="ctx-item" @click="ctxEditEdge"><el-icon><EditPen /></el-icon>设置关系文字</div>
        <div class="ctx-item danger" @click="ctxDeleteEdge"><el-icon><Delete /></el-icon>删除连线</div>
      </template>
    </div>
  </div>
  <HomeEmpty v-else />
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Delete, Memo, EditPen, Grid } from '@element-plus/icons-vue'
import { VueFlow, Handle, useVueFlow, MarkerType } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import dagre from 'dagre'
import HomeEmpty from '@/components/common/HomeEmpty.vue'
import { useCanvasStore } from '@/stores/canvas'
import { useCardStore } from '@/stores/card'
import { useEditorStore } from '@/stores/editor'
import { useUiStore } from '@/stores/ui'

const canvasStore = useCanvasStore()
const cardStore = useCardStore()
const editorStore = useEditorStore()
const ui = useUiStore()
const { screenToFlowCoordinate, getSelectedNodes, getSelectedEdges, removeNodes, removeEdges, fitView } = useVueFlow()

const nodes = ref<any[]>([])
const edges = ref<any[]>([])

// 连线统一外观：主题蓝贝塞尔曲线 + 箭头 + 深色药丸标签托底
const EDGE_COLOR = '#5c6bc0'
const edgeBase = {
  style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 16, height: 16 },
  labelStyle: { fill: '#7986cb', fontSize: 12 },
  labelBgStyle: { fill: '#1e1e1e', fillOpacity: 0.95, stroke: '#333333' },
  labelBgPadding: [8, 4] as [number, number],
  labelBgBorderRadius: 4
}

/**
 * 加载激活画布：后端快照转换为 Vue Flow 数据结构
 */
watch(
  () => ui.activeItemId,
  async (id) => {
    if (!id || ui.activeType !== 'canvas') return
    await canvasStore.fetchSnapshot(id)
    nodes.value = canvasStore.nodes.map((n) => ({
      id: n.node_key,
      type: 'card',
      position: { x: n.x, y: n.y },
      data: {
        cardId: n.card_id,
        label: n.label || n.card_title || '',
        summary: n.card_content || '',
        color: n.card_color || undefined
      }
    }))
    edges.value = canvasStore.edges.map((e) => ({
      id: `e-${e.source_key}-${e.target_key}`,
      source: e.source_key,
      target: e.target_key,
      label: e.label || undefined,
      ...edgeBase
    }))
  },
  { immediate: true }
)

/**
 * 目录树重命名后同步画布标题：store 中标题变化时刷新 activeTitle，
 * 保证画布头部与顶栏始终显示最新名称
 */
watch(
  () => editorStore.items.find((x) => x.id === ui.activeItemId)?.title,
  (t) => {
    if (t && ui.activeType === 'canvas' && t !== ui.activeTitle) ui.activeTitle = t
  }
)

/**
 * 拖入卡片库卡片：在落点创建画布节点
 */
function onDrop(e: DragEvent) {
  const raw = e.dataTransfer?.getData('application/x-card')
  if (!raw) return
  const card = JSON.parse(raw)
  const position = screenToFlowCoordinate({ x: e.clientX, y: e.clientY })
  nodes.value.push({
    id: `n${Date.now()}`,
    type: 'card',
    position,
    data: { cardId: card.id, label: card.title, summary: card.content, color: card.color }
  })
}

/**
 * 连线完成：登记新边（默认无关系描述，可在 Inspector 后续补充）
 */
function onConnect(params: { source: string; target: string }) {
  edges.value.push({
    id: `e-${params.source}-${params.target}-${Date.now()}`,
    source: params.source,
    target: params.target,
    label: undefined,
    ...edgeBase
  })
}

/**
 * 双击节点：打开关联卡片的 Inspector
 */
function onNodeDoubleClick({ node }: { node: { data: { cardId: number | null; label: string } } }) {
  if (node.data.cardId) {
    ui.openInspectorCard(node.data.cardId)
  } else if (node.data.label) {
    cardStore.openByTitle(node.data.label)
  }
}

/**
 * 卡片库变更（Inspector 保存后刷新列表）时，实时同步画布对应节点的标题/内容/颜色
 */
watch(
  () => cardStore.list.map((c) => `${c.id}:${c.title}:${c.content}:${c.color}`).join('|'),
  () => {
    for (const n of nodes.value) {
      const cid = n.data?.cardId
      if (!cid) continue
      const card = cardStore.list.find((c) => c.id === cid)
      if (card) {
        n.data = { ...n.data, label: card.title, summary: card.content, color: card.color }
      }
    }
  }
)

// 是否存在选中内容（节点或连线），控制删除按钮可用态
const hasSelection = computed(
  () => getSelectedNodes.value.length > 0 || getSelectedEdges.value.length > 0
)

/**
 * 删除选中的节点与连线（键盘 Delete 同样生效）
 */
function deleteSelection() {
  if (getSelectedNodes.value.length) removeNodes(getSelectedNodes.value)
  if (getSelectedEdges.value.length) removeEdges(getSelectedEdges.value)
}

// 自动布局动画开关：期间给节点加 transform 过渡，位置滑动而非瞬移
const layoutAnimating = ref(false)

/**
 * 智能自动布局：dagre 按连线流向（左→右）分层排列节点，
 * 孤立节点自动排在首列；动画结束后贴合视口，新坐标随既有防抖 watch 持久化
 */
function autoLayout() {
  if (!nodes.value.length) return
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 110 })
  for (const n of nodes.value) g.setNode(n.id, { width: 200, height: 110 })
  for (const e of edges.value) g.setEdge(e.source, e.target)
  dagre.layout(g)
  layoutAnimating.value = true
  nodes.value = nodes.value.map((n) => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - 100, y: p.y - 55 } }
  })
  setTimeout(() => {
    layoutAnimating.value = false
    fitView({ padding: 0.2 })
  }, 520)
}

/**
 * 双击连线：设置/清除关系描述文字
 */
function onEdgeDoubleClick({ edge }: { edge: { label?: string } }) {
  ElMessageBox.prompt('关系描述（如：师徒、死敌，留空则清除）', '设置连线文字', {
    inputValue: edge.label || '',
    inputPlaceholder: '例如：师徒'
  })
    .then(({ value }) => {
      edge.label = value && value.trim() ? value.trim() : undefined
    })
    .catch(() => {})
}

// ---------- 右键菜单 ----------
const ctx = reactive({
  visible: false,
  x: 0,
  y: 0,
  kind: 'node' as 'node' | 'edge',
  node: null as any,
  edge: null as any
})

/**
 * 打开右键菜单：定位到鼠标处并防止越界
 */
function openCtx(e: MouseEvent, kind: 'node' | 'edge', payload: any) {
  e.preventDefault()
  ctx.kind = kind
  ctx.node = kind === 'node' ? payload : null
  ctx.edge = kind === 'edge' ? payload : null
  ctx.x = Math.min(e.clientX, window.innerWidth - 190)
  ctx.y = Math.min(e.clientY, window.innerHeight - 150)
  ctx.visible = true
}

function onNodeCtx({ event, node }: { event: MouseEvent; node: any }) {
  openCtx(event, 'node', node)
}

function onEdgeCtx({ event, edge }: { event: MouseEvent; edge: any }) {
  openCtx(event, 'edge', edge)
}

/**
 * 右键打开关联卡片的 Inspector
 */
function ctxOpenCard() {
  const node = ctx.node
  closeCtx()
  if (node) onNodeDoubleClick({ node })
}

/**
 * 右键删除节点
 */
function ctxDeleteNode() {
  if (ctx.node) removeNodes([ctx.node])
  closeCtx()
}

/**
 * 右键设置连线关系文字
 */
function ctxEditEdge() {
  const edge = ctx.edge
  closeCtx()
  if (edge) onEdgeDoubleClick({ edge })
}

/**
 * 右键删除连线
 */
function ctxDeleteEdge() {
  if (ctx.edge) removeEdges([ctx.edge])
  closeCtx()
}

/**
 * 关闭右键菜单（点击空白处 / Escape）
 */
function closeCtx() {
  ctx.visible = false
}

function onGlobalClick() {
  closeCtx()
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeCtx()
}

onMounted(() => {
  window.addEventListener('click', onGlobalClick)
  window.addEventListener('keydown', onGlobalKeydown)
})

// 变更防抖保存：整体覆盖式快照
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(doSave, 800)
}

/**
 * 执行画布保存
 */
async function doSave() {
  const id = ui.activeItemId
  if (!id || ui.activeType !== 'canvas') return
  await canvasStore.saveSnapshot(id, {
    nodes: nodes.value.map((n) => ({
      id: n.id, cardId: n.data?.cardId ?? null, label: n.data?.label || '', x: n.position.x, y: n.position.y
    })),
    edges: edges.value.map((e) => ({ source: e.source, target: e.target, label: e.label || '' }))
  })
}

watch([nodes, edges], scheduleSave, { deep: true })

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
  window.removeEventListener('click', onGlobalClick)
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<style scoped>
/* 画布模式：细密点阵深色网格背景，辅助对齐 */
.canvas-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-base);
}
.canvas-header {
  height: var(--header-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}
.canvas-title {
  font-size: var(--fs-title);
  font-weight: 700;
  color: var(--text-primary);
}
.canvas-tip {
  font-size: var(--fs-caption);
  color: var(--text-tertiary);
}
.canvas-tools {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.tool-btn {
  color: var(--text-secondary);
  transition: color var(--transition-fast), background-color var(--transition-fast);
}
.tool-btn:hover:not(:disabled) {
  color: var(--primary-strong);
  background: var(--bg-hover);
}
.tool-btn:disabled {
  color: var(--text-tertiary);
}
.canvas-flow {
  flex: 1;
  min-height: 0;
  background-image: radial-gradient(circle, var(--border-strong) 1px, transparent 1px);
  background-size: 16px 16px;
}
/* 自动布局动画期间：节点位置平滑滑动 */
.canvas-flow.layout-animating :deep(.vue-flow__node) {
  transition: transform 0.5s ease;
}

/* 卡片节点：不透明深灰底 + 暗投影，从点阵背景上“浮”起来；尺寸紧凑，内容绝不溢出 */
.canvas-card {
  position: relative;
  width: 150px;
  background: #252526;
  color: #e0e0e0;
  border: 1px solid var(--border-subtle);
  border-left: 4px solid var(--primary);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  transition: box-shadow var(--transition-fast), border-color var(--transition-fast);
  cursor: grab;
}
.canvas-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--primary-bg-hover);
}
.canvas-card-head {
  padding: 3px 8px;
  background: var(--bg-card-head);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  font-size: var(--fs-card);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.canvas-card-body {
  padding: 4px 8px;
  font-size: var(--fs-card);
  color: #e0e0e0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

/* 左侧目标锚点与右侧蓝色连线锚点 */
.canvas-handle {
  width: 8px;
  height: 8px;
  background: var(--border-strong);
  border: none;
}
.canvas-anchor {
  width: 10px;
  height: 10px;
  background: var(--primary);
  border: 2px solid var(--bg-base);
  transition: transform var(--transition-fast);
}
.canvas-anchor:hover {
  transform: scale(1.3);
}

/* 画布右键菜单 */
.ctx-menu {
  position: fixed;
  z-index: 100;
  min-width: 160px;
  padding: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card-drag);
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 7px 10px;
  font-size: var(--fs-caption);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.ctx-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.ctx-item.danger:hover {
  color: #e57373;
}
</style>

<style>
/* 连线全局样式：淡蓝贝塞尔曲线（Vue Flow 内部 SVG 不受 scoped 限制） */
.vue-flow__edge-path {
  stroke: var(--primary);
  stroke-width: 1.5;
}
/* 选中态反馈：连线加粗提亮，节点蓝描边 + 光晕 */
.vue-flow__edge.selected .vue-flow__edge-path {
  stroke: var(--primary-strong);
  stroke-width: 2.5;
}
.vue-flow__node.selected .canvas-card {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(92, 107, 192, 0.3), 0 8px 24px rgba(0, 0, 0, 0.5);
}
.vue-flow__node.dragging .canvas-card {
  box-shadow: var(--shadow-card-drag);
  cursor: grabbing;
}
</style>

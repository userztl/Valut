<template>
  <!-- 登录页独立渲染，不带应用外壳 -->
  <router-view v-if="isLoginRoute" />
  <div v-else class="app-frame">
    <!-- 全局顶栏：产品标识 / 当前条目 / 用户与登出 -->
    <header class="app-topbar">
      <div class="topbar-left">
        <span class="brand-mark"></span>
        <span class="brand-name">WriterVault</span>
      </div>
      <div class="topbar-center">
        <template v-if="ui.activeItemId">
          <span class="crumb-type">{{ ui.activeType === 'canvas' ? '画布' : '文档' }}</span>
          <el-icon class="crumb-sep"><CaretRight /></el-icon>
          <span class="crumb-title">{{ ui.activeTitle }}</span>
        </template>
        <span v-else class="crumb-title crumb-placeholder">未选择条目</span>
      </div>
      <div class="topbar-right">
        <span class="user-chip">
          <span class="user-avatar">{{ usernameInitial }}</span>
          <span class="user-name">{{ displayName }}</span>
        </span>
        <el-tooltip content="退出登录" placement="bottom">
          <el-button text size="small" class="logout-btn" @click="logout">
            <el-icon><SwitchButton /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </header>

    <div class="app-shell">
      <AppSidebar />
      <main
        class="app-main"
        @pointerdown="onEdgeSwipeStart"
        @pointermove="onEdgeSwipeMove"
        @pointerup="onEdgeSwipeEnd"
        @pointercancel="resetEdgeHint"
      >
        <!-- 侧栏收起后浮现在屏幕左缘的展开按钮 -->
        <button v-if="ui.sidebarCollapsed" class="sidebar-expand" title="展开侧栏" @click="ui.toggleSidebar()">
          <el-icon><Expand /></el-icon>
        </button>
        <!-- 左缘右滑拖拽反馈：渐强右箭头提示可展开 -->
        <div v-show="edgeHint.active" class="edge-hint" :style="{ opacity: 0.25 + edgeHint.progress * 0.75 }">
          <el-icon class="edge-arrow" :class="{ ready: edgeHint.progress >= 1 }"><DArrowRight /></el-icon>
          <span class="edge-text">{{ edgeHint.progress >= 1 ? '松开展开侧栏' : '继续右滑' }}</span>
        </div>
        <router-view />
      </main>
      <AppInspector />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CaretRight, Expand, SwitchButton, DArrowRight } from '@element-plus/icons-vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppInspector from '@/components/layout/AppInspector.vue'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const isLoginRoute = computed(() => route.path === '/login')

// 启动时恢复用户的全局字号档位（写入 html[data-fs]）
ui.applyFontSize()

// 登录时记录的用户名，用于顶栏展示
const displayName = computed(() => localStorage.getItem('username') || 'admin')
const usernameInitial = computed(() => displayName.value.slice(0, 1).toUpperCase())

/**
 * 退出登录：清除本地会话并回到登录页
 */
function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  router.replace('/login')
}

// ---------- 滑动手势：侧栏收起后，从左缘向右滑展开（触摸 / 鼠标拖拽均生效） ----------
let edgeTracking = false
let edgeStartX = 0
let edgeStartY = 0

// 拖拽进度反馈：active 控制提示显隐，progress(0~1) 驱动渐强与达标态
const edgeHint = reactive({ active: false, progress: 0 })

/**
 * 仅当触摸/按下起点位于主区左缘 48px 内才跟踪右滑手势，避免与画布拖拽冲突
 */
function onEdgeSwipeStart(e: PointerEvent) {
  if (!ui.sidebarCollapsed) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  edgeTracking = e.clientX - rect.left <= 48
  if (!edgeTracking) return
  edgeStartX = e.clientX
  edgeStartY = e.clientY
  resetEdgeHint()
}

/**
 * 拖拽过程：横向右移且主导纵向时显示提示，progress 随距离渐增至达标
 */
function onEdgeSwipeMove(e: PointerEvent) {
  if (!edgeTracking) return
  const dx = e.clientX - edgeStartX
  const dy = Math.abs(e.clientY - edgeStartY)
  if (dx <= 0 || dx < dy * 1.5) {
    resetEdgeHint()
    return
  }
  const threshold = e.pointerType === 'mouse' ? 100 : 60
  edgeHint.active = true
  edgeHint.progress = Math.min(1, dx / threshold)
}

/**
 * 手势判定：右滑达到阈值时展开侧栏，并复位提示
 */
function onEdgeSwipeEnd(e: PointerEvent) {
  if (!edgeTracking) return
  edgeTracking = false
  const reached = edgeHint.progress >= 1
  resetEdgeHint()
  if (reached) ui.toggleSidebar()
}

function resetEdgeHint() {
  edgeHint.active = false
  edgeHint.progress = 0
}
</script>

<style scoped>
/* 应用框架：顶栏 + 三栏 IDE 布局 */
.app-frame {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* 全局顶栏 */
.app-topbar {
  height: var(--topbar-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(var(--space-3), 2vw, var(--space-5));
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: clamp(120px, 18vw, 280px);
}
.brand-mark {
  width: clamp(14px, 1.4vw, 18px);
  height: clamp(14px, 1.4vw, 18px);
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  box-shadow: 0 0 8px rgba(92, 107, 192, 0.4);
}
.brand-name {
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}
.topbar-center {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
  justify-content: center;
}
.crumb-type {
  font-size: var(--fs-caption);
  color: var(--primary-strong);
  background: var(--primary-bg);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.crumb-sep {
  font-size: var(--fs-caption);
  color: var(--text-tertiary);
}
.crumb-title {
  font-size: var(--fs-body);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.crumb-placeholder {
  color: var(--text-tertiary);
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: clamp(120px, 18vw, 280px);
  justify-content: flex-end;
}
.user-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 3px 10px 3px 3px;
  border-radius: 16px;
  background: var(--bg-hover);
  max-width: 160px;
}
.user-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary);
  color: #ffffff;
  font-size: var(--fs-caption);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.user-name {
  font-size: var(--fs-caption);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.logout-btn {
  color: var(--text-secondary);
  transition: color var(--transition-fast), background-color var(--transition-fast);
}
.logout-btn:hover {
  color: var(--primary-strong);
  background: var(--bg-hover);
}

/* 三栏 IDE 布局：侧栏(自适应) + 主区(flex) + Inspector(滑出) */
.app-shell {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.app-main {
  flex: 1;
  min-width: 0;
  background: var(--bg-base);
  overflow: hidden;
  position: relative;
}

/* 侧栏收起后的展开按钮：贴屏幕左缘居中 */
.sidebar-expand {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 48px;
  border: 1px solid var(--border-subtle);
  border-left: none;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition-fast), background-color var(--transition-fast);
  z-index: 10;
}
.sidebar-expand:hover {
  color: var(--primary-strong);
  background: var(--bg-hover);
}

/* 左缘右滑反馈：贴左缘的渐隐提示条，pointer-events 关闭不拦截画布操作 */
.edge-hint {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: clamp(120px, 18vw, 200px);
  z-index: 9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  background: linear-gradient(90deg, rgba(92, 107, 192, 0.18), rgba(20, 20, 20, 0));
  pointer-events: none;
  transition: opacity var(--transition-fast);
}
.edge-arrow {
  font-size: clamp(28px, 4vh, 40px);
  color: var(--text-secondary);
  transition: color var(--transition-fast), transform var(--transition-fast);
}
.edge-arrow.ready {
  color: var(--primary-strong);
  transform: translateX(6px);
}
.edge-text {
  writing-mode: vertical-lr;
  font-size: var(--fs-caption);
  color: var(--text-secondary);
}
.edge-hint:has(.edge-arrow.ready) .edge-text {
  color: var(--primary-strong);
}
</style>

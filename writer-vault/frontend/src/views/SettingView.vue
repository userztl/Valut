<template>
  <div class="setting-view scrollable">
    <!-- 外观设置：全局字号档位 -->
    <section class="setting-block">
      <h2 class="block-title">外观</h2>

      <div class="setting-row">
        <div class="row-label">
          <span class="row-name">界面字号</span>
          <span class="row-desc">全局控制文档、画布、侧栏与 Inspector 的字体大小，选择后立即生效并记住偏好</span>
        </div>
        <el-radio-group :model-value="ui.fontSizeLevel" @change="onFontSizeChange">
          <el-radio-button value="sm">小</el-radio-button>
          <el-radio-button value="md">标准</el-radio-button>
          <el-radio-button value="lg">大</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 实时预览：随档位缩放 -->
      <div class="font-preview">
        <p class="preview-title">标题示例 Aa Bb Cc 123</p>
        <p class="preview-body">正文示例：天地玄黄，宇宙洪荒。字体大小随档位实时缩放。</p>
        <p class="preview-caption">辅助文字示例：caption 级别的小字</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useUiStore, type FontSizeLevel } from '@/stores/ui'

const ui = useUiStore()

/**
 * 字号档位切换回调：持久化选择并写入 html[data-fs]，驱动全局 CSS 缩放
 * @param level el-radio-group 透传的档位值（sm / md / lg）
 */
function onFontSizeChange(level: FontSizeLevel) {
  ui.setFontSizeLevel(level)
}
</script>

<style scoped>
.setting-view {
  height: 100%;
  padding: var(--space-4) clamp(var(--space-4), 6vw, 96px);
  background: var(--bg-base);
}

.setting-block {
  max-width: 720px;
}

.block-title {
  margin: 0 0 var(--space-3);
  font-size: var(--fs-title);
  font-weight: 600;
  color: var(--text-primary);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.row-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-name {
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--text-primary);
}

.row-desc {
  font-size: var(--fs-caption);
  color: var(--text-secondary);
}

/* 预览区：使用全局字号变量，切换档位时实时变化 */
.font-preview {
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
}

.preview-title {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-title);
  font-weight: 600;
  color: var(--text-primary);
}

.preview-body {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-doc);
  line-height: var(--lh-doc);
  color: var(--text-primary);
}

.preview-caption {
  margin: 0;
  font-size: var(--fs-caption);
  color: var(--text-secondary);
}
</style>

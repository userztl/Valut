<template>
  <div class="home-empty">
    <div class="home-mark"></div>
    <h2 class="home-title">WriterVault</h2>
    <p class="home-desc">从大纲写作到跑团记录，从一张空白页开始</p>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.home-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  background: var(--bg-base);
}
.home-mark {
  width: clamp(44px, 6vh, 64px);
  height: clamp(44px, 6vh, 64px);
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  box-shadow: 0 8px 24px rgba(92, 107, 192, 0.35);
}
.home-title {
  margin: 0;
  font-size: clamp(18px, 1.2vw + 8px, 24px);
  font-weight: 700;
  color: var(--text-primary);
}
.home-desc {
  margin: 0;
  font-size: var(--fs-body);
  color: var(--text-tertiary);
}
</style>

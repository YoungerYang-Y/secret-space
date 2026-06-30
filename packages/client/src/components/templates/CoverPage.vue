<script setup lang="ts">
defineProps<{ year: number; title: string | null; coverUrl: string | null }>()
</script>

<template>
  <div class="cover-page">
    <img v-if="coverUrl" :src="coverUrl" alt="封面" class="cover-img" />
    <div class="cover-info">
      <h1 class="cover-year">{{ year }}</h1>
      <p v-if="title" class="cover-title">{{ title }}</p>
    </div>
  </div>
</template>

<style scoped>
.cover-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--theme-from, #fef9f4), var(--theme-to, #fde8d0));
  padding: 24px;
  box-sizing: border-box;
  transition: background 0.6s;
}
.cover-img {
  max-width: 70%;
  max-height: 60%;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
.cover-info {
  margin-top: 16px;
  text-align: center;
}
.cover-year {
  font-size: 32px;
  font-weight: 700;
  color: var(--theme-text, #8b5e3c);
  margin: 0;
}
.cover-title {
  font-size: 16px;
  color: var(--theme-sub, #a07050);
  margin: 8px 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .cover-page {
    transition: none;
  }
}
</style>

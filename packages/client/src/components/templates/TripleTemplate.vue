<script setup lang="ts">
defineProps<{ content: { images: string[]; text?: string } }>()
</script>

<template>
  <div class="template-triple">
    <img v-for="(img, i) in content.images.slice(0, 3)" :key="i" :src="img" loading="lazy" alt="" />
  </div>
</template>

<style scoped>
.template-triple {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 8px;
  padding: 16px;
  box-sizing: border-box;
}
.template-triple img:first-child {
  grid-row: 1 / -1;
}
.template-triple img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}
</style>

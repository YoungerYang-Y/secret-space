<script setup lang="ts">
defineProps<{ content: { images: string[]; text?: string } }>()
</script>

<template>
  <div class="template-double-v">
    <img v-if="content.images[0]" :src="content.images[0]" loading="lazy" alt="" />
    <img v-if="content.images[1]" :src="content.images[1]" loading="lazy" alt="" />
  </div>
</template>

<style scoped>
.template-double-v {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: 8px;
  padding: 16px;
  box-sizing: border-box;
}
.template-double-v img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}
</style>

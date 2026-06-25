<script setup lang="ts">
defineProps<{ content: { images: string[]; text?: string } }>()
</script>

<template>
  <div class="template-single">
    <img v-if="content.images[0]" :src="content.images[0]" loading="lazy" alt="" />
  </div>
</template>

<style scoped>
.template-single {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}
.template-single img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
}
</style>

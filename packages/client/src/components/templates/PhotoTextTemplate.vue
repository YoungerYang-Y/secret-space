<script setup lang="ts">
defineProps<{ content: { images: string[]; text?: string } }>()
</script>

<template>
  <div class="template-photo-text">
    <img v-if="content.images[0]" :src="content.images[0]" loading="lazy" alt="" />
    <p v-if="content.text" class="caption">{{ content.text }}</p>
  </div>
</template>

<style scoped>
.template-photo-text {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  box-sizing: border-box;
  gap: 12px;
}
.template-photo-text img {
  flex: 1;
  width: 100%;
  object-fit: contain;
  border-radius: 4px;
  min-height: 0;
}
.caption {
  text-align: center;
  font-size: 14px;
  color: #555;
  margin: 0;
  line-height: 1.5;
}
</style>

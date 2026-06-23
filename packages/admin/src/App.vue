<script setup lang="ts">
import { useRoute } from 'vue-router'
import Layout from './components/Layout.vue'

const route = useRoute()
</script>

<template>
  <Layout v-if="route.name !== 'login'">
    <router-view />
  </Layout>
  <router-view v-else />
</template>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>

<template>
  <div class="back-cover">
    <span class="back-cover-text">— 完 —</span>
  </div>
</template>

<style scoped>
.back-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--theme-from, #fef9f4), var(--theme-to, #fde8d0));
  transition: background 0.6s;
}
.back-cover-text {
  font-size: 18px;
  color: var(--theme-sub, #a07050);
}

@media (prefers-reduced-motion: reduce) {
  .back-cover {
    transition: none;
  }
}
</style>

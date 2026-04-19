<template>
  <div
    v-html="html"
    class="preview"
    ref="previewContainer"
    @scroll="emit('scroll', $event)"
  ></div>
</template>

<script setup>
// 预览区组件
import { ref } from "vue";
const emit = defineEmits(["scroll"]);
const props = defineProps(["html"]);
const previewContainer = ref(null);
// 【重要】暴露给父组件
defineExpose({
  scrollElement: previewContainer,
});
</script>

<style scoped>
.preview {
  font-size: 16px;
  line-height: 1.6;
  padding: 40px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background-color: var(--el-bg-color); /* 👈 改用变量 */
  color: var(--el-text-color-primary); /* 👈 改用变量 */
  overflow-y: auto; /* 允许垂直滚动 */
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
    Arial, sans-serif;
}
/* 可选：优化预览区的标题样式，使其层次分明 */
.preview pre {
  background-color: #f6f8fa; /* 代码块背景色 */
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto; /* 允许代码横向滚动 */
}
.preview code {
  font-family: "Menlo", "Monaco", "Courier New", monospace;
  font-size: 0.9em;
}
.preview h1 {
  font-size: 2em;
  margin-bottom: 0.5em;
}
.preview h2 {
  font-size: 1.5em;
  margin-bottom: 0.5em;
}
.preview p {
  margin-bottom: 1em;
}
</style>

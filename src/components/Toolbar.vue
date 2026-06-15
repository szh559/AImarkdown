<template>
  <div class="toolbar-row">
    <el-button type="primary" plain @click="$emit('clear')">一键清空</el-button>

    <el-divider direction="vertical" />

    <el-button type="primary" @click="$emit('toggleOutline')">
      {{ showOutline ? "隐藏大纲" : "显示大纲" }}
    </el-button>

    <el-button @click="insert = !insert" type="primary">插入功能</el-button>
    <div class="insert-gn" v-show="insert">
      <!-- 标题组 -->
      <el-button @click="$emit('insert', '# ', '')">H1</el-button>
      <el-button @click="$emit('insert', '## ', '')">H2</el-button>
      <el-button @click="$emit('insert', '### ', '')">H3</el-button>

      <el-divider direction="vertical" />

      <!-- 样式组 -->
      <el-button @click="$emit('insert', '**', '**')">粗体</el-button>
      <el-button @click="$emit('insert', '*', '*')">斜体</el-button>
      <el-button @click="$emit('insert', '~~', '~~')">删除线</el-button>
      <el-button @click="$emit('insert', '`', '`')">行内代码</el-button>

      <el-divider direction="vertical" />

      <!-- 列表与引用 -->
      <el-button @click="$emit('insert', '- ', '')">列表</el-button>
      <el-button @click="$emit('insert', '> ', '')">引用</el-button>
      <el-button @click="$emit('insert', '```\n', '\n```')">代码块</el-button>
    </div>

    <!-- 字数统计（右侧自动推过去） -->
    <span class="word-count">{{ wordCount }}字</span>
  </div>
</template>

<script setup>
import { ref } from "vue";

defineEmits(["clear", "insert", "toggleOutline"]);

defineProps({
  showOutline: {
    type: Boolean,
    default: false,
  },
  wordCount: {
    type: Number,
    default: 0,
  },
});

const insert = ref(false);
</script>

<style scoped>
.toolbar-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 4px;
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.insert-gn {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px;
}

.insert-gn :deep(.el-button) {
  padding: 4px 8px;
  font-size: 12px;
  height: 28px;
}

.word-count {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  white-space: nowrap;
}
</style>

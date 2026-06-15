<template>
  <div class="ai-row">
    <el-button type="success" plain :loading="aiLoading" @click="handleGenerate"
      >AI生成</el-button
    >
    <el-button
      type="success"
      plain
      :loading="aiLoading"
      @click="handlePolishMarkdown"
      >AI润色</el-button
    >
    <el-button
      type="success"
      plain
      :loading="aiLoading"
      @click="handleSummarizeMarkdown"
      >AI总结</el-button
    >
    <el-button
      type="success"
      plain
      :loading="aiLoading"
      @click="handleOptimizeCode"
      >AI优化代码</el-button
    >
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { ElMessage } from "element-plus";
import {
  generateMarkdown,
  polishMarkdown,
  summarizeMarkdown,
  optimizeCode,
} from "../utils/ai";

const props = defineProps({
  content: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update"]);

const aiLoading = ref(false); // AI 加载状态

// 为每个功能单独维护流式内容缓存（解决替换/追加混乱问题）
const polishCache = ref(""); // 润色专用缓存
const optimizeCache = ref(""); // 优化代码专用缓存

// ========== 核心：按功能拆分流式写入逻辑 ==========

/**
 * AI生成 - 清空后追加
 */
const writeGenerate = (chunk) => {
  emit("update", props.content + chunk);
};

/**
 * AI润色 - 先缓存所有chunk，完成后一次性替换
 */
const writePolish = (chunk) => {
  polishCache.value += chunk; // 先缓存所有润色内容
};

/**
 * AI总结 - 追加到末尾
 */
const writeSummarize = (chunk) => {
  emit("update", props.content + chunk);
};

/**
 * AI优化代码 - 先缓存所有chunk，完成后一次性替换选中部分
 */
const writeOptimize = (chunk) => {
  optimizeCache.value += chunk; // 先缓存所有优化后代码
};

// ========== 1. AI生成（清空后追加） ==========
const handleGenerate = async () => {
  const topic = prompt("请输入文章主题：", "Vue3 入门教程");
  if (!topic || aiLoading.value) return;

  aiLoading.value = true;
  emit("update", ""); // 清空原有内容

  try {
    await generateMarkdown(
      topic,
      (chunk) => writeGenerate(chunk), // 逐段追加
      () => {
        aiLoading.value = false;
        ElMessage.success("AI生成完成！");
      },
      (error) => {
        aiLoading.value = false;
        ElMessage.error(`生成失败：${error}`);
      },
    );
  } catch (err) {
    aiLoading.value = false;
    ElMessage.error(`生成异常：${err.message}`);
  }
};

// ========== 2. AI润色（一次性替换全部内容）==========
const handlePolishMarkdown = async () => {
  const originalContent = props.content.trim();
  if (!originalContent || aiLoading.value) {
    ElMessage.warning("请输入需要润色的内容！");
    return;
  }

  aiLoading.value = true;
  polishCache.value = ""; // 清空润色缓存

  try {
    await polishMarkdown(
      originalContent,
      (chunk) => writePolish(chunk), // 先缓存所有润色内容
      () => {
        // 流式结束后，一次性替换整个编辑区
        emit("update", polishCache.value);
        polishCache.value = ""; // 清空缓存
        aiLoading.value = false;
        ElMessage.success("润色完成！");
      },
      (error) => {
        aiLoading.value = false;
        polishCache.value = "";
        ElMessage.error(`润色失败：${error}`);
      },
    );
  } catch (err) {
    aiLoading.value = false;
    polishCache.value = "";
    ElMessage.error(`润色异常：${err.message}`);
  }
};

// ========== 3. AI总结（追加到内容末尾） ==========
const handleSummarizeMarkdown = async () => {
  const originalContent = props.content.trim();
  if (!originalContent || aiLoading.value) {
    ElMessage.warning("请输入需要总结的内容！");
    return;
  }

  aiLoading.value = true;
  // 先在末尾加分隔符
  const summaryPrefix = "\n\n--- 以下是AI总结 ---\n\n";
  emit("update", props.content + summaryPrefix);

  try {
    await summarizeMarkdown(
      originalContent,
      (chunk) => writeSummarize(chunk), // 逐段追加总结
      () => {
        aiLoading.value = false;
        ElMessage.success("总结完成！");
      },
      (error) => {
        // 失败回滚：恢复原内容
        emit("update", originalContent);
        aiLoading.value = false;
        ElMessage.error(`总结失败：${error}`);
      },
    );
  } catch (err) {
    emit("update", originalContent);
    aiLoading.value = false;
    ElMessage.error(`总结异常：${err.message}`);
  }
};

// ========== 4. AI优化代码（一次性替换选中部分）==========
const handleOptimizeCode = async () => {
  if (aiLoading.value) return;

  // 获取选中的代码（无选中则取全部）
  // 注意：textareaRef 由父组件通过 expose 提供，这里无法直接获取
  // 暂时取全部内容进行优化
  const selectedCode = props.content.trim();

  if (!selectedCode) {
    ElMessage.warning("请输入需要优化的代码片段！");
    return;
  }

  aiLoading.value = true;
  optimizeCache.value = ""; // 清空优化缓存
  const originalContent = props.content; // 备份原内容

  try {
    await optimizeCode(
      selectedCode,
      (chunk) => writeOptimize(chunk), // 先缓存所有优化后代码
      () => {
        // 流式结束后，一次性替换内容
        emit("update", optimizeCache.value);
        optimizeCache.value = ""; // 清空缓存

        aiLoading.value = false;
        ElMessage.success("代码优化完成！");
      },
      (error) => {
        aiLoading.value = false;
        optimizeCache.value = "";
        emit("update", originalContent); // 失败回滚
        ElMessage.error(`优化失败：${error}`);
      },
    );
  } catch (err) {
    aiLoading.value = false;
    optimizeCache.value = "";
    emit("update", originalContent);
    ElMessage.error(`优化异常：${err.message}`);
  }
};
</script>

<style scoped>
.ai-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
}
</style>

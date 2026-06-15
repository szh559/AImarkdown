<template>
  <div class="editor-container">
    <!-- 大纲面板（纯面板，无按钮） -->
    <outline-nav
      :content="data"
      v-model:visible="showOutline"
      @jump="jumpContent"
    ></outline-nav>

    <!-- 工具栏：一键清空 + 插入功能 + 显示大纲 -->
    <Toolbar
      @clear="clearData"
      @insert="insertMarkdown"
      @toggle-outline="showOutline = !showOutline"
      :outline-visible="showOutline"
      :word-count="wordCount"
    ></Toolbar>

    <!-- 编辑区 -->
    <div class="editor">
      <textarea
        v-model="data"
        placeholder="请输入md内容"
        ref="textareaRef"
        @scroll="handleScroll"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import hotkeys from "hotkeys-js"; // 1. 引入 hotkeys
import { watch, ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { ElMessage } from "element-plus";

import OutlineNav from "./OutlineNav.vue";
import Toolbar from "./Toolbar.vue";

const emit = defineEmits(["input", "scroll", "jump"]);
const props = defineProps(["content"]);

//拿到传过来的数据
const data = ref(props.content);
const textareaRef = ref(null); // 定义一个空引用
const showOutline = ref(false); // 大纲面板显示状态

//点击大纲跳转 — 直接透传给 App，由 App 统一处理双栏滚动
const jumpContent = (line) => {
  emit("jump", line);
};

const handleScroll = (e) => {
  emit("scroll", e);
};

//调用快捷键函数
onMounted(() => {
  hotkeys.filter = () => true;
  hotkeys("ctrl+b", ctrlb);
  hotkeys("ctrl+i", ctrli);
  hotkeys("ctrl+k", ctrlk);
});

//解绑快捷键函数
onUnmounted(() => {
  hotkeys.unbind("ctrl+b");
  hotkeys.unbind("ctrl+i");
  hotkeys.unbind("ctrl+k");
});

//ctrl+k插入链接
const ctrlk = (event) => {
  event.preventDefault();
  const url = prompt("请输入链接地址:", "https://");
  const linkName = prompt("请输入链接名:");
  if (url && linkName) {
    insertMarkdown(`[${linkName}`, `](${url})`);
  }
};

//ctrl+b加粗
const ctrlb = (event) => {
  event.preventDefault(); // 阻止默认保存行为
  insertMarkdown("**", "**");
};

//ctrl+i斜体
const ctrli = (event) => {
  event.preventDefault(); // 阻止默认保存行为
  insertMarkdown("*", "*");
};

// 【重要】暴露给父组件，让父组件能直接操作 textarea 的 scrollTop
defineExpose({
  scrollElement: textareaRef,
});
//当前字数功能
const wordCount = computed(() => {
  return data.value.replace(/\s/g, "").length;
});

//插入markdown语法函数实现
const insertMarkdown = (qian, hou) => {
  const textarea = textareaRef.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = data.value;

  const before = text.substring(0, start);
  const selected = text.substring(start, end);
  const after = text.substring(end);

  const newText = before + qian + selected + hou + after;

  // 注意：execCommand 会直接操作 DOM，所以我们需要手动同步回 data.value
  //这是为了用浏览器原生的ctrl+y和ctrl+z
  document.execCommand("insertText", false, qian + selected + hou);

  data.value = newText;

  //防止DOM未更新光标就改变
  nextTick(() => {
    textarea.focus();
    //计算光标的位置
    const newCursorPos = start + qian.length + selected.length;
    // 改变光标的位置
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  });
};

//编辑区变时调用
watch(data, (newValue) => {
  // 只有当新值与当前 props 不同时(应该是储存的)才发射，避免不必要的循环
  if (newValue !== props.content) {
    emit("input", newValue);
  }
});

// 这样当 App.vue 从 localStorage 读取数据并更新 mdContent 时，Editor 也能收到
watch(
  () => props.content,
  (newVal) => {
    // 只有当外部传入的值与内部当前值不同时才更新，防止光标跳动或输入冲突
    if (newVal !== data.value) {
      data.value = newVal;
    }
  },
);

//清空功能
const clearData = () => {
  data.value = "";
};
</script>

<style scoped>
/* .button 样式已移至 Toolbar.vue */
/* .Nav 样式已移至 OutlineNav.vue */

.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor {
  flex: 1;
  overflow: hidden;
}
textarea {
  background-color: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  border: 1px solid var(--el-border-color);
  width: 100%;
  height: 100%;
  outline: none;
  overflow-y: auto;
  resize: none;
  line-height: 1.6;
  font-size: 18px;
  font-family: "Menlo", "Monaco", "Courier New", monospace;
  box-sizing: border-box;
}
textarea::placeholder {
  color: #999;
  opacity: 1;
  font-size: 25px;
}
</style>

<template>
  <!-- 左侧：大纲导航 -->
  <div class="Nav" v-show="showNav">
    <ul class="outline-list">
      <h3>文件大纲</h3>

      <li
        @click="jumpContent(item.lineIndex)"
        class="outline-item"
        v-for="item of parseHeader"
        :key="item.lineIndex"
        :class="'level-' + item.level"
      >
        {{ item.text }}
      </li>
    </ul>
  </div>
  <div class="button">
    <el-button @click="showNav = !showNav" type="primary">{{
      showNav ? "隐藏大纲" : "显示大纲"
    }}</el-button>
    <el-button type="primary" plain @click="clearData">一键清空</el-button>

    <el-button type="success" plain @click="handleGenerate">AI生成</el-button>
    <el-button type="success" plain @click="handlePolishMarkdown"
      >AI润色</el-button
    >
    <el-button type="success" plain @click="handleSummarizeMarkdown"
      >AI总结</el-button
    >
    <el-button type="success" plain @click="handleOptimizeCode"
      >AI优化代码</el-button
    >
    <el-button @click="insertOpen" type="primary">插入功能</el-button>
    <div class="insert-gn" v-show="insert">
      <!-- 标题组 -->
      <el-button size="small" @click="insertMarkdown('# ', '')">H1</el-button>
      <el-button size="small" @click="insertMarkdown('## ', '')">H2</el-button>
      <el-button size="small" @click="insertMarkdown('### ', '')">H3</el-button>

      <el-divider direction="vertical" />

      <!-- 样式组 -->
      <el-button size="small" @click="insertMarkdown('**', '**')"
        >粗体</el-button
      >
      <el-button size="small" @click="insertMarkdown('*', '*')">斜体</el-button>
      <el-button size="small" @click="insertMarkdown('~~', '~~')"
        >删除线</el-button
      >
      <el-button size="small" @click="insertMarkdown('`', '`')"
        >行内代码</el-button
      >

      <el-divider direction="vertical" />

      <!-- 列表与引用 -->
      <el-button size="small" @click="insertMarkdown('- ', '')">列表</el-button>
      <el-button size="small" @click="insertMarkdown('> ', '')">引用</el-button>
      <el-button size="small" @click="insertMarkdown('```\n', '\n```')"
        >代码块</el-button
      >
      <el-divider direction="vertical" />
    </div>
  </div>
  <!-- 编辑区组件 -->
  <div class="editor">
    <textarea
      v-model="data"
      placeholder="请输入md内容"
      ref="textareaRef"
      @scroll="emit('scroll', $event)"
    ></textarea>
  </div>
  <div class="count">当前字数：{{ wordCount }}字</div>
</template>

<script setup>
import hotkeys from "hotkeys-js"; // 1. 引入 hotkeys
import { watch, ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { ElMessage } from "element-plus";
import {
  generateMarkdown,
  polishMarkdown,
  summarizeMarkdown,
  optimizeCode,
} from "../utils/ai";

const emit = defineEmits(["input", "scroll", "jump"]);
const props = defineProps(["content"]);

//拿到传过来的数据
const data = ref(props.content);
const showNav = ref(false);
const insert = ref(false);
const textareaRef = ref(null); // 定义一个空引用
const aiLoading = ref(false); // AI 加载状态
let timer = null;
let buffer = "";
let isWriting = false;
// 为每个功能单独维护流式内容缓存（解决替换/追加混乱问题）
const polishCache = ref(""); // 润色专用缓存
const optimizeCache = ref(""); // 优化代码专用缓存

// 【核心简化】流式写入：仅给data.value追加内容（放弃光标精细控制）
const streamWriteToEditor = (chunk) => {
  // 只有流式写入状态开启时，才拼串
  if (isWriting) {
    data.value += chunk; // 核心：直接给data.value拼串
    console.log("当前data.value：", data.value); // 可选：打印验证
  }
};

// 重置流式状态（简化版）
const resetStreamWrite = () => {
  aiLoading.value = false;
  isWriting = false;
};

// ========== 核心：按功能拆分流式写入逻辑 ==========
/**
 * AI生成 - 清空后追加
 */
const writeGenerate = (chunk) => {
  data.value += chunk;
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
  data.value += chunk;
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
  data.value = ""; // 清空原有内容

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

// ========== 2. AI润色（替换全部内容）由逐段追加改为一次性替换 因为前面的会被覆盖 ==========
// 新增 polishCache 缓存变量，先把所有润色返回的 chunk 缓存起来；
// 流式请求结束后（onSuccess 回调），一次性把缓存的完整内容赋值给 data.value；
// 彻底避免逐段替换导致的内容丢失，确保润色后完整替换原有内容。
const handlePolishMarkdown = async () => {
  const originalContent = data.value.trim();
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
        data.value = polishCache.value;
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
// 新增 optimizeCache 缓存变量，缓存所有优化后的代码片段；
// 流式结束后，一次性把完整的优化代码替换到选中位置；
// 加 nextTick 确保 DOM 更新后选中优化后的代码，方便查看完整内容
const handleSummarizeMarkdown = async () => {
  const originalContent = data.value.trim();
  if (!originalContent || aiLoading.value) {
    ElMessage.warning("请输入需要总结的内容！");
    return;
  }

  aiLoading.value = true;
  // 先在末尾加分隔符
  const summaryPrefix = "\n\n--- 以下是AI总结 ---\n\n";
  data.value += summaryPrefix;

  try {
    await summarizeMarkdown(
      originalContent,
      (chunk) => writeSummarize(chunk), // 逐段追加总结
      () => {
        aiLoading.value = false;
        ElMessage.success("总结完成！");
      },
      (error) => {
        // 失败回滚：去掉分隔符，恢复原内容
        data.value = originalContent;
        aiLoading.value = false;
        ElMessage.error(`总结失败：${error}`);
      },
    );
  } catch (err) {
    data.value = originalContent;
    aiLoading.value = false;
    ElMessage.error(`总结异常：${err.message}`);
  }
};

// ========== 4. AI优化代码（修复：一次性替换，确保内容完整显示） ==========
const handleOptimizeCode = async () => {
  const textarea = textareaRef.value;
  if (!textarea || aiLoading.value) return;

  // 获取选中的代码（无选中则取全部）
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedCode =
    start === end ? data.value.trim() : data.value.slice(start, end).trim();

  if (!selectedCode) {
    ElMessage.warning("请选择/输入需要优化的代码片段！");
    return;
  }

  aiLoading.value = true;
  optimizeCache.value = ""; // 清空优化缓存
  const originalContent = data.value; // 备份原内容
  const preContent = data.value.slice(0, start); // 选中前的内容
  const postContent = data.value.slice(end); // 选中后的内容

  try {
    await optimizeCode(
      selectedCode,
      (chunk) => writeOptimize(chunk), // 先缓存所有优化后代码
      () => {
        // 流式结束后，一次性替换选中部分
        data.value = preContent + optimizeCache.value + postContent;
        optimizeCache.value = ""; // 清空缓存

        // 可选：选中优化后的代码，方便查看
        nextTick(() => {
          textarea.selectionStart = preContent.length;
          textarea.selectionEnd =
            preContent.length + optimizeCache.value.length;
          textarea.focus();
        });

        aiLoading.value = false;
        ElMessage.success("代码优化完成！");
      },
      (error) => {
        aiLoading.value = false;
        optimizeCache.value = "";
        data.value = originalContent; // 失败回滚
        ElMessage.error(`优化失败：${error}`);
      },
    );
  } catch (err) {
    aiLoading.value = false;
    optimizeCache.value = "";
    data.value = originalContent;
    ElMessage.error(`优化异常：${err.message}`);
  }
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

//解析标题 拿到h1-h6 标题 行号
const parseHeader = computed(() => {
  //把所有内容按行分割
  const lines = data.value.split("\n");
  //用数组存每个标题的等级 内容 行数
  const headings = [];
  //数组遍历
  lines.forEach((line, lineIndex) => {
    // 匹配#
    const match = line.match(/^(#{1,6})\s(.+)/);
    if (match) {
      headings.push({
        level: match[1].length, //等级
        text: match[2].trim(), //内容
        lineIndex, //行数
      });
    }
  });
  return headings;
});

//点击大纲跳转
const jumpContent = (line) => {
  //让父元素滚动
  emit("jump", line);

  //让编辑器的光标移动
  // 1. 直接获取当前组件内的 textarea DOM 元素
  const textarea = textareaRef.value;
  if (textarea) {
    //计算有多少个字符 然后光标跳到他后面
    const lines = data.value.split("\n");
    let charIndex = 0;
    for (let i = 0; i < line; i++) {
      charIndex += lines[i].length + 1;
    }
    //获取焦点并跳转光标
    showNav.value = false;
    textarea.focus();
    textarea.setSelectionRange(charIndex, charIndex);
  }
};

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
//插入功能的折叠
const insertOpen = () => {
  insert.value = !insert.value;
};

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
.button {
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: var(--el-bg-color); /* 👈 改用变量 */
  height: 70px;
}
/* 基础样式 */
.outline-item {
  white-space: nowrap; /* 防止文字换行，保持整洁 */
  overflow: hidden;
  text-overflow: ellipsis; /* 超出部分显示省略号 */
  cursor: pointer;
  padding: 4px 8px; /* 增加点击区域 */
  margin: 2px 0;
  border-radius: 4px;
  transition: all 0.2s; /* 悬停动画 */
  color: var(--el-text-color-regular);
}
/* --- 层级样式 (缩进 + 字体大小 + 颜色) --- */

/* H1: 最大，最左，深色 */
.level-1 {
  font-size: 16px;
  font-weight: bold;
  padding-left: 10px; /* 基础缩进 */
  color: #2c3e50;
}

/* H2: 稍小，缩进多一点 */
.level-2 {
  font-size: 15px;
  font-weight: 600;
  padding-left: 25px; /* 缩进 15px */
  color: #34495e;
}

/* H3: 正常大小，继续缩进 */
.level-3 {
  font-size: 14px;
  padding-left: 40px; /* 缩进 30px */
  color: #555;
}

/* H4: 稍小，灰色 */
.level-4 {
  font-size: 13px;
  padding-left: 55px; /* 缩进 45px */
  color: #777;
}

/* H5: 更小 */
.level-5 {
  font-size: 12px;
  padding-left: 70px; /* 缩进 60px */
  color: #999;
}

/* H6: 最小，最右 */
.level-6 {
  font-size: 12px;
  padding-left: 85px; /* 缩进 75px */
  color: #aaa;
  font-style: italic; /* H6 可以用斜体区分 */
}

.outline-item:hover {
  background-color: rgba(0, 0, 0, 0.05); /* 悬停背景色 */
}
.Nav {
  overflow: hidden;
  position: absolute;
  top: 92px;
  left: -1px;
  height: 100%;
  background-color: var(--el-bg-color-overlay); /* 👈 改用变量 */
  color: var(--el-text-color-primary); /* 👈 改用变量 */
  width: 255px;
  box-sizing: border-box;
}
.outline-list {
  overflow: auto;
  list-style: none;
  height: 85%;
  position: relative;
  top: -10px;
  left: -2px;
}
.outline-list li {
  white-space: normal;
  word-break: break-all;
  line-height: 1.5;
  cursor: pointer;
  margin: 10px 20px;
  padding-right: 8px;
  color: #0f5132;
}

.other,
.insert-gn {
  margin-top: 6px;
}
.count {
  position: fixed;
  z-index: 1000; /* 确保显示在其他内容之上 */
  left: 21.5%;
  top: 96.5%;
}
.editor {
  width: 100%;
  height: calc(94% - 50px);
  overflow: hidden;
}
textarea {
  margin-top: 6px;
  background-color: var(--el-fill-color-blank); /* 👈 改用变量 */
  color: var(--el-text-color-primary); /* 👈 改用变量 */
  border: 1px solid var(--el-border-color); /* 👈 改用变量 */
  width: 100%;
  height: 100%;
  outline: none; /* 去掉聚焦时的边框 */
  overflow-y: auto;
  resize: none;
  line-height: 1.6;
  font-size: 18px;
  font-family:
    "Menlo", "Monaco", "Courier New", monospace; /* 可选：使用等宽字体更像代码编辑器 */
  box-sizing: border-box;
}
textarea::placeholder {
  color: #999; /* 加深颜色 */
  opacity: 1; /* 确保不透明 */
  font-size: 25px;
}
.button-row {
  display: flex;
  justify-content: space-around;
}
</style>

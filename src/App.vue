<template>
  <div class="all">
    <!-- 切换按钮 (放在最外层，确保不被遮挡) -->
    <el-button class="theme-btn" @click="toggleTheme" circle>
      {{ dark ? "☀️" : "🌙" }}
    </el-button>
    <div class="left">
      <AIActions :content="mdContent" @update="mdContent = $event"></AIActions>
      <!-- 数据改变拿数据并且计算HTML 并且传回去（在本地储存的时候用） -->
      <Editor
        @jump="handJump"
        @input="updated"
        :content="mdContent"
        ref="editorRef"
        @scroll="handleEditorScroll"
        style="flex: 1; min-height: 0"
      />
    </div>
    <!-- 给预览区传解析好的HTML -->
    <div class="right">
      <Preview :html="mdHtml" ref="previewRef" @scroll="handlePreviewScroll">
      </Preview>
    </div>
    <!-- 导入导出 -->
    <div class="file">
      <el-button type="primary" plain @click="exportMd">导出MD</el-button>
      <el-button type="success" plain @click="triggerImport">导入MD</el-button>
      <!-- 隐藏的文件输入框 -->
      <input
        type="file"
        ref="fileInputRef"
        accept=".md,.txt"
        style="display: none"
        @change="handleFileChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ElMessage } from "element-plus";
import { marked } from "marked";
//这个会执行配置 marked 插件，添加自定义的渲染规则
import { mdToHtml } from "./utils/mdParse";
import { computed, onMounted, ref, nextTick } from "vue";
import Editor from "./components/Editor.vue";
import Preview from "./components/Preview.vue";
import AIActions from "./components/AIActions.vue";

const mdContent = ref(""); //Markdown原文，整个项目的唯一数据源
const dark = ref(false); //黑夜模式

// 在滚动同步的场景下，“死循环”指的是：
// A 区域滚动 -> 触发事件 -> 代码强制滚动 B 区域 -> B 区域滚动触发事件 -> 代码强制滚动 A 区域 -> A 区域又触发事件……
const isSyncing = ref(false); // 【新增】同步锁，防止死循环

const fileInputRef = ref(null);
const editorRef = ref(null);
const previewRef = ref(null);

//导出md
const exportMd = () => {
  if (!mdContent.value) {
    ElMessage.warning("当前内容为空，无法导出");
    return;
  }

  //1.创建blob对象 把内容包裹成一个文件
  const blob = new Blob([mdContent.value], {
    type: "text/markdown;charset=utf-8",
  });

  //2.创建下载链接
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  //3.设置文件名
  const date = new Date().toISOString().slice(0, 10);
  link.download = `markdown-note-${date}.md`;

  //4.用代码触发下载链接
  document.body.appendChild(link);
  link.click();

  //5.清理这个链接元素
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

//处理导入的md 这个函数就是触发选择文件的事件
const triggerImport = () => {
  fileInputRef.value.click();
};

//真正处理导入的文件
const handleFileChange = (event) => {
  //1.文件选择
  const file = event.target.files[0];
  if (!file) return;

  //2.校验文件类型
  if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
    ElMessage.error("请上传 .md 或 .txt 格式的文件");
    return;
  }

  //3.1 创建一个读文件的实例
  const reader = new FileReader();

  //3.2 文件读完的回调
  reader.onload = (e) => {
    // 更新数据源
    mdContent.value = e.target.result;
    //手动触发一次保存逻辑（因为 watch 可能会因为值相同而不触发，或者为了即时性）
    localStorage.setItem("mdContent", e.target.result);
    ElMessage.success("导入成功！");
  };

  //3.3 开始读取文件 把文件转为文本
  reader.readAsText(file);

  //4. 清空 input 的值，防止重复上传同一个文件不触发 change
  event.target.value = "";
};

//更新编辑区数据
const updated = (newdata) => {
  //把更新的数据拿到 给数据源
  mdContent.value = newdata;
  //保存在本地
  localStorage.setItem("mdContent", newdata);
};

//数据源改变 然后去解析HTML 当mdContent的值变了 自动将其解析为HTML返回
const mdHtml = computed(() => {
  return marked.parse(mdContent.value);
});

//获取真正滚动的元素

//  父组件 Ref 绑定子组件实例 ➡️
//  子组件内部 Ref 绑定 滚动DOM ➡️
//  子组件 defineExpose 暴露 滚动DOM ➡️
//  父组件访问实例属性获取 真正的滚动DOM ➡️
//  执行原生 DOM 操作。
const getScrollDom = (componentRef) => {
  if (!componentRef) return null;
  // 子组件用defineExpose 暴露了滚动的元素
  if (componentRef.scrollElement) {
    return componentRef.scrollElement;
  }
};

//处理同步滚动的函数
const handleScroll = (zdDom, bdDom) => {
  //先检查元素是否存在（必须在上锁之前，否则会死锁）
  if (!zdDom || !bdDom) return;
  //如果被上锁了 证明有一边的回调在调用
  if (isSyncing.value) return;
  //上锁
  isSyncing.value = true;
  //计算主动滚动区的比例
  const ratio = zdDom.scrollTop / (zdDom.scrollHeight - zdDom.clientHeight);
  // 设置被动滚动区的滚动位置
  bdDom.scrollTop = ratio * (bdDom.scrollHeight - bdDom.clientHeight);
  //解锁
  nextTick(() => {
    isSyncing.value = false;
  });
};

//编辑区滚动 -> 同步给预览区
const handleEditorScroll = () => {
  handleScroll(getScrollDom(editorRef.value), getScrollDom(previewRef.value));
};

//预览区滚动 -> 同步给编辑区
const handlePreviewScroll = () => {
  handleScroll(getScrollDom(previewRef.value), getScrollDom(editorRef.value));
};

//处理大纲跳转
const handJump = (lineIndex) => {
  // console.log(lineIndex);

  //获取编辑区滚动元素
  const editorDom = getScrollDom(editorRef.value);
  //获取预览区滚动元素
  const previewDom = getScrollDom(previewRef.value);
  if (!editorDom || !previewDom) return;

  const targetHigh = 29 * lineIndex;

  //计算最大可滚动的距离
  const maxEditorScroll = editorDom.scrollHeight - editorDom.clientHeight;
  let jump = 0;
  if (maxEditorScroll > 0) {
    jump = targetHigh / maxEditorScroll;
    if (jump > 1) jump = 1;
  }

  isSyncing.value = true;

  //滚动
  editorDom.scrollTo({
    top: targetHigh,
    behavior: "smooth",
  });
  previewDom.scrollTo({
    top: jump * (previewDom.scrollHeight - previewDom.clientHeight),
    behavior: "smooth",
  });

  //滚动动画结束后解锁
  setTimeout(() => {
    isSyncing.value = false;
  }, 300);
};

// 👇 新增：切换主题函数
const toggleTheme = () => {
  dark.value = !dark.value;
  if (dark.value) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
};

//拿本地数据+恢复主题设置
onMounted(() => {
  const saveDate = localStorage.getItem("mdContent") || "";
  if (saveDate) {
    mdContent.value = saveDate;
  }

  // 2. 👇 新增：恢复主题设置
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    dark.value = true;
    document.documentElement.classList.add("dark");
  }
});
</script>

<style scoped>
.all {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  /* 👇 使用 Element Plus 的背景色变量，实现自动变色 */
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
}
/* 👇 新增：按钮定位样式 */
.theme-btn {
  position: fixed;
  top: 15px;
  right: 20px;
  z-index: 9999;
}
.file {
  position: fixed;
  top: 15px;
  right: 85px;
  z-index: 9999;
}
.left {
  padding-top: 15px;
  border-right: 3px solid var(--el-border-color);
  margin-left: 8px;
  display: flex;
  flex-direction: column;
}
.left {
  width: 50%;
  height: 100%;
  position: relative;
}
.right {
  width: 50%;
  height: 100%;
  overflow: hidden;
}
</style>

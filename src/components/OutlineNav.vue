<!--
  ============================================================
  OutlineNav 大纲导航组件
  ============================================================

  【功能】解析 Markdown 中的 # 标题，生成可点击的大纲导航列表
  【位置】作为 Editor.vue 的子组件，通过 props 接收编辑内容
  【控制】显示/隐藏由父组件通过 v-model:visible 控制

  ------------------------------------------------------------
  🐛 Bug 记录：大纲跳转需要点两次才能生效
  ------------------------------------------------------------

  【场景】
    用户点击大纲中的某个标题项 → 编辑区和预览区应该同步跳转到对应位置
    实际表现：第一次点击不跳转（或跳到错误位置），第二次点击才正常

  【原因分析 — 共涉及两个问题】

  问题①：事件传递链断裂
  ─────────────────────
  调用链：
    OutlineNav.emit("jump", line)
      → Editor.jumpContent(line) 接收了
      → Editor 内部用 setSelectionRange() 操作光标
      → ❌ 但 Editor 没有再把 jump 事件 emit 给 App！
      → App.handJump() 从来没被调用过
      → App 里的 scrollTo(smooth) 双栏同步跳转逻辑从未执行

    结果：只有 setSelectionRange 让 textarea 滚了一下，
          这个滚动又触发了 @scroll → handleEditorScroll（滚动同步），
          把位置覆盖掉了，导致第一次跳到错误位置。

  问题②：v-show 隐藏打断 scrollTo 动画
  ─────────────────────
  如果在 jumpCon 里立即执行 showNav = false：
    点击大纲 → emit("jump") 启动 scrollTo(smooth) 动画 🎬
             → 同时 showNav = false → v-show 隐藏 .Nav DOM 变动
             → 布局重算 → scrollTo 动画被中断 ❌

  【解决方案】
  ─────────────────────
  ① 修复事件传递：Editor.jumpContent() 不再自己操作光标/滚动，
     而是 emit("jump") 直接透传给 App，由 App.handJump() 统一处理双栏滚动。
     （Editor 只做中间人，不干预滚动逻辑）

  ② 修复时序问题：jumpCon 里先 emit 触发跳转，
     用 setTimeout(150ms) 延迟隐藏大纲，
     等 scrollTo 动画启动并稳定后再执行 v-show 隐藏。

  ③ 样式修复：.Nav 的 CSS 样式必须写在当前组件内（OutlineNav.vue），
     不能写在父组件 Editor.vue 中。因为 Vue 的 <style scoped> 会给选择器
     加上 [data-v-xxxx] 属性限定，无法穿透到子组件内部的 DOM 元素。
     导致 position/z-index 等定位样式失效，大纲被其他元素遮挡或显示异常。

  【关键词】
    事件透传 / scrollTo 动画时序 / v-show DOM 重绘 / scoped 样式穿透 /
    双栏滚动同步 / setSelectionRange 副作用
  ============================================================
-->
<template>
  <!-- 大纲面板 -->
  <div class="Nav" v-show="visible">
    <ul class="outline-list">
      <h3>文件大纲</h3>
      <li
        @click="jumpCon(item.lineIndex)"
        class="outline-item"
        v-for="item of parseHeader"
        :key="item.lineIndex"
        :class="'level-' + item.level"
      >
        {{ item.text }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  content: {
    type: String,
    default: "",
  },
  visible: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["jump", "update:visible"]);

//解析标题 拿到h1-h6 标题 行号
const parseHeader = computed(() => {
  const lines = props.content.split("\n");
  const headings = [];
  lines.forEach((line, lineIndex) => {
    const match = line.match(/^(#{1,6})\s(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        lineIndex,
      });
    }
  });
  return headings;
});

// 点击大纲项 → 跳转 + 延迟自动关闭
const jumpCon = (line) => {
  emit("jump", line);
  setTimeout(() => {
    emit("update:visible", false);
  }, 150);
};
</script>

<style scoped>
/* 大纲容器 — 定位样式 */
.Nav {
  position: fixed;
  top: 92px;
  left: 8px;
  width: 255px;
  height: calc(100vh - 100px);
  background-color: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  box-sizing: border-box;
  z-index: 999;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.outline-list {
  overflow-y: auto;
  list-style: none;
  height: 100%;
  padding: 10px 0;
  margin: 0;
}
.outline-item {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  padding: 4px 8px;
  margin: 2px 0;
  border-radius: 4px;
  transition: all 0.2s;
  color: var(--el-text-color-regular);
  background-color: transparent;
}
/* --- 层级样式 --- */
.level-1 {
  font-size: 16px;
  font-weight: bold;
  padding-left: 10px;
  color: #2c3e50;
}
.level-2 {
  font-size: 15px;
  font-weight: 600;
  padding-left: 25px;
  color: #34495e;
}
.level-3 {
  font-size: 14px;
  padding-left: 40px;
  color: #555;
}
.level-4 {
  font-size: 13px;
  padding-left: 55px;
  color: #777;
}
.level-5 {
  font-size: 12px;
  padding-left: 70px;
  color: #999;
}
.level-6 {
  font-size: 12px;
  padding-left: 85px;
  color: #aaa;
  font-style: italic;
}
.outline-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
</style>

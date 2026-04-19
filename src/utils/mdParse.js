// markdown解析+代码高亮工具
// 引入marked（Markdown解析库）
import { marked, Renderer } from "marked";
// 引入highlight.js（代码高亮库）
import hljs from "highlight.js";
// 引入highlight.js浅色模式样式（github风格，本地npm包内文件）
import "highlight.js/styles/github.css";
// （可选）引入highlight.js暗黑模式样式，用于主题切换
import "highlight.js/styles/github-dark.css";

// 创建自定义渲染器
const renderer = new Renderer();

// 重写 code 方法以支持 highlight.js
// 修复：参数改为解构对象 { text, lang, escaped }
renderer.code = ({ text, lang, escaped }) => {
  // 1. 验证语言是否支持，不支持则回退到 plaintext
  const validLang = lang && hljs.getLanguage(lang) ? lang : "plaintext";

  // 2. 执行高亮
  // 注意：hljs.highlight 第一个参数是代码内容(text)，第二个是配置对象
  const highlighted = hljs.highlight(text, { language: validLang }).value;

  // 3. 返回包裹好的 HTML，添加必要的 class 以便 CSS 定位
  return `<pre><code class="hljs language-${validLang}">${highlighted}</code></pre>`;
};

// 配置 marked
marked.use({
  gfm: true, // 开启 GitHub 风格 Markdown
  breaks: true, // 允许回车换行
  renderer, // 注入自定义渲染器
});

/**
 * 将 Markdown 字符串转换为 HTML 字符串
 * @param md - Markdown 原始内容
 * @returns 解析后的 HTML 字符串
 */
export function mdToHtml(md) {
  if (!md) return "";
  // marked.parse 返回的是 string | Promise<string>，同步模式下直接转为 string
  return marked.parse(md);
}

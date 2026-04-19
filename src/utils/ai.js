// 后端地址
const API_BASE_URL = "http://localhost:3000/api";

/**
 * 通用流式 AI 请求（完全适配星火官方响应）
 */
export const streamAIRequest = async (
  action,
  content,
  //收到字符执行
  onChunk,
  //完成执行
  onComplete = () => {},
  //出错执行
  onError = (err) => console.error("AI错误：", err),
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, content, stream: true }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        `接口错误 ${response.status}：${errData.error || "未知错误"}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 强制UTF-8解码，杜绝乱码
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const trimChunk = chunk.trim();
        if (!trimChunk.startsWith("data: ")) continue;

        const jsonStr = trimChunk.slice(6);
        if (jsonStr === "[DONE]") {
          onComplete();
          return;
        }

        try {
          const data = JSON.parse(jsonStr);
          // 处理官方错误码
          if (data.code !== 0 && data.error) {
            onError(`[${data.code}] ${data.error}`);
            return;
          }
          // 传递官方返回的文本
          if (data.text) onChunk(data.text);
        } catch (e) {
          console.warn("无效的星火响应数据：", jsonStr, e);
        }
      }
    }

    onComplete();
  } catch (error) {
    console.error("AI请求异常：", error);
    onError(error.message);
  }
};

// === 功能函数保持不变（仅prompt优化） ===
export const generateMarkdown = (topic, onChunk, onComplete, onError) => {
  const prompt = `请围绕主题"${topic}"生成结构清晰的Markdown格式文章，直接输出内容，无需额外说明`;
  return streamAIRequest("generate", prompt, onChunk, onComplete, onError);
};

export const polishMarkdown = (content, onChunk, onComplete, onError) => {
  const prompt = `请润色以下Markdown内容，保留原有格式和核心信息，优化语言表达：\n${content}`;
  return streamAIRequest("polish", prompt, onChunk, onComplete, onError);
};

export const summarizeMarkdown = (content, onChunk, onComplete, onError) => {
  const prompt = `请总结以下Markdown内容，输出简洁的Markdown格式总结，不超过300字：\n${content}`;
  return streamAIRequest("summarize", prompt, onChunk, onComplete, onError);
};

export const optimizeCode = (code, onChunk, onComplete, onError) => {
  const prompt = `请优化以下代码，修复语法错误、提升可读性和性能，直接输出优化后的代码，无需额外说明：\n${code}`;
  return streamAIRequest("optimize", prompt, onChunk, onComplete, onError);
};

const express = require("express");
const axios = require("axios");
const app = express();

// 中间件
app.use(express.json());
// 跨域配置
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ========================
// 替换为你控制台获取的 APIPassword
// ========================
const APIPassword = "ozBNYlHBfYNjbOvRPvKA:EuIgOVFBxDdAbNPaazHN";
const SPARK_API = "https://spark-api-open.xf-yun.com/v1/chat/completions";

// 流式接口（完全对齐官方规范）
app.post("/api/chat", async (req, res) => {
  // 设置SSE响应头（官方要求）
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const { action, content, stream = true } = req.body;
    if (!content) {
      safeSendError(res, 10000, "内容不能为空");
      return;
    }

    // 官方标准请求参数（lite模型）
    const requestData = {
      model: "lite", // 严格对应官方：lite=星火Lite版本
      messages: [{ role: "user", content: content }],
      stream: stream,
      temperature: 0.5, // 官方默认1.0，推理场景建议1.2
      max_tokens: 4096, // Lite版本最大4096
      presence_penalty: 1.2, // 官方默认1.2
      frequency_penalty: 0.02, // 官方默认0.02
    };

    // 请求星火AI（严格按官方请求头）
    const response = await axios.post(SPARK_API, requestData, {
      headers: {
        Authorization: `Bearer ${APIPassword}`, // 官方要求的Bearer认证
        "Content-Type": "application/json",
      },
      responseType: "stream",
      timeout: 60000, // 超时时间60s
    });

    // 转发并解析官方流式响应
    response.data.on("data", (chunk) => {
      try {
        const str = chunk.toString("utf8");
        const lines = str.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);

          // 处理结束标识
          if (jsonStr === "[DONE]") {
            res.write("data: [DONE]\n\n");
            continue;
          }

          // 解析官方响应体
          const data = JSON.parse(jsonStr);

          // 处理官方错误码（非0均为错误）
          if (data.code !== 0) {
            safeSendError(res, data.code, data.message || "AI响应错误");
            return;
          }

          // 提取官方的流式内容（delta.content）
          const text = data.choices?.[0]?.delta?.content || "";
          if (text) {
            res.write(
              `data: ${JSON.stringify({
                code: 0,
                text: text,
                sid: data.sid,
              })}\n\n`,
            );
          }
        }
      } catch (e) {
        console.warn("流式解析异常：", e);
      }
    });

    // 流结束处理
    response.data.on("end", () => {
      res.write("data: [DONE]\n\n");
      res.end();
    });

    // 流错误处理
    response.data.on("error", (err) => {
      safeSendError(res, 9999, `AI服务连接异常：${err.message}`);
    });
  } catch (err) {
    // 捕获请求级错误（如401授权、网络错误）
    const errMsg =
      err.response?.data?.error?.message ||
      err.message ||
      "请求AI失败，请检查APIPassword";
    const errCode = err.response?.status || 9999;
    console.error("请求失败：", errCode, errMsg);
    safeSendError(res, errCode, errMsg);
  }
});

// 安全发送错误（对齐官方格式）
function safeSendError(res, code, msg) {
  try {
    res.write(
      `data: ${JSON.stringify({
        code: code,
        error: msg,
      })}\n\n`,
    );
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    res.end();
  }
}

// 启动服务
app.listen(3000, () => {
  console.log("✅ 后端服务启动：http://localhost:3000");
});

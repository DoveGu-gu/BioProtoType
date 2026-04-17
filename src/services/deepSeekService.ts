// src/services/deepSeekService.ts

// 定义 DeepSeek API 的响应结构接口
interface DeepSeekResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 定义消息格式
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// 配置常量 (敏感信息已移入 .env 文件)
const API_URL =
  import.meta.env.VITE_DEEPSEEK_API_URL ||
  "https://api.deepseek.com/chat/completions";
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || "";

/**
 * 调用 DeepSeek Chat 模型
 * @param messages 对话历史上下文
 * @returns 模型返回的文本内容
 */
export const fetchDeepSeekChat = async (
  messages: ChatMessage[],
): Promise<string> => {
  if (!API_KEY || API_KEY.startsWith("sk-xxxx")) {
    console.warn("未配置 DeepSeek API Key，将使用模拟数据。");
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          "【系统提示】检测到未配置有效的 API Key。请在 src/services/deepSeekService.ts 中填入您的 DeepSeek API Key 才能进行真实对话。\n\n" +
            "当前为模拟回复：DeepSeek-V3 是一款强大的大语言模型，能够处理复杂的逻辑推理和文本生成任务。",
        );
      }, 1000);
    });
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "你是一个细胞生物学专家，名叫细胞助手。你的任务是根据用户提供的文本内容，并在对话过程中提供专业的生物学知识解答。你的工作流程分为4个步骤：1、根据用户输入的内容，理解用户的需求，与用户对话逐步明确用户目标的知识点具体内容；2、将明确的知识点内容进行拆分，提取其中涉及的细胞结构和生物学大分子，以及它们所参与的细胞过程；3、将具体的知识点内容反馈给用户；4、当知识点足够明确时，告知用户“接下来我将启动知识点可视化工作流”，并不再引导用户继续提问。你要遵循以下限制：1.当用户的输入与细胞生物学知识无关的内容时，拒绝回答，并提醒用户询问细胞生物学内容。2.当用户输入的内容存在错误时，指出用户表达的错误之处，纠正用户的表达。3.不要使用表格列出内容。4.在知识点明确之前，不要在回答中出现“可视化工作流”或“知识点可视化工作流”短语。",
          },
          ...messages,
        ],
        stream: false, // 暂时使用非流式传输
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API 请求失败: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`,
      );
    }

    const data: DeepSeekResponse = await response.json();
    return (
      data.choices[0]?.message?.content ||
      "抱歉，我没有从模型获取到有效的回复。"
    );
  } catch (error) {
    console.error("DeepSeek API 调用出错:", error);
    throw error;
  }
};

/**
 * 获取15字以内的总结
 * @param content 需要总结的文本内容
 * @returns 模型返回的总结内容
 */
export const fetchTaskNameSummary = async (
  content: string,
): Promise<string> => {
  if (!API_KEY || API_KEY.startsWith("sk-xxxx")) {
    return "模拟细胞知识点";
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "你是一个细胞生物学知识点总结助手。你的任务是总结给定的文本中涉及的细胞生物学过程，并且总结为一句话，字数严格限制在15个字以内，不要加任何标点符号或【】等装饰。使用“RNA翻译蛋白质”、“核输入蛋白转运”等简洁的短语来总结知识点。直接返回总结内容，不要添加任何解释或多余的文字。",
          },
          {
            role: "user",
            content,
          },
        ],
        stream: false,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`);
    }

    const data: DeepSeekResponse = await response.json();
    return data.choices[0]?.message?.content?.trim() || "未总结出结果";
  } catch (error) {
    console.error("fetchTaskNameSummary 调用出错:", error);
    throw error;
  }
};

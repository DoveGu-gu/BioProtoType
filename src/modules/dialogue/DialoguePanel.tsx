// src/modules/dialogue/DialoguePanel.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  Input,
  Button,
  Avatar,
  Typography,
  message,
  Popconfirm,
  Tooltip,
} from "antd";
import {
  UserOutlined,
  RobotOutlined,
  SendOutlined,
  LoadingOutlined,
  DeleteOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useAppStore } from "../../store/useAppStore"; // 引入全局 Store
import {
  fetchDeepSeekChat,
  fetchTaskNameSummary,
  type ChatMessage,
} from "../../services/deepSeekService"; // 引入 DeepSeek 服务
import { trackerService } from "../../services/trackerService"; // 引入数据埋点服务
import { calculateSimilarity } from "../../utils/stringUtils"; // 引入相似度计算函数
import taskFlowConfig from "../../config/taskFlowConfig.json";

const { TextArea } = Input;
const { Text } = Typography;

// 1. 定义消息的数据结构
interface Message {
  id: string;
  sender: "user" | "bot";
  content: string;
}

// 2. 本地存储的 Key 与默认欢迎语
const STORAGE_KEY = "local_ai_chat_history";
const defaultWelcomeMessage: Message = {
  id: "1",
  sender: "bot",
  content:
    "您好！我是细胞助手，专注于细胞生物学领域的知识解答。请您提出与细胞生物学相关的问题，我将为您提供专业的解答。例如，您可以询问关于细胞结构、功能、代谢过程或相关分子机制等内容。期待您的提问！",
};

import { workflowController } from "../../controllers/workflowController";

const DialoguePanel: React.FC = () => {
  // 从全局 Store 中提取当前登录的用户 ID 以及需要持久化的建议（Review数据）
  const { userId, suggestions, setSuggestions } = useAppStore();

  // 3. 状态管理 (使用惰性初始化从 localStorage 读取历史记录)
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const savedMessages = localStorage.getItem(STORAGE_KEY);
      if (savedMessages) {
        return JSON.parse(savedMessages);
      }
    } catch (error) {
      console.error("解析本地对话记录失败，将使用默认状态:", error);
    }
    return [defaultWelcomeMessage];
  });

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasFetchedUserId = useRef<string | null>(null); // 防重复加载标记
  const dataLoadedForUserId = useRef<string | null>(null); // 确认数据加载完毕的标记
  const typingStartTimeRef = useRef<number | null>(null); // 记录用户开始输入的时间

  // 4. 核心功能：直接提交请求到 Vite 后端，实现自动写入本地物理文件
  const writeToJsonFile = async (dialogues: Message[], reviews: any[]) => {
    // 只有当加载完毕的用户等于当前用户时，才允许写入（防止切换用户时误用旧数据覆盖新用户文件）
    if (!userId || dataLoadedForUserId.current !== userId) return;

    try {
      const exportData = {
        dialogues: dialogues.map((msg) => ({
          id: msg.id,
          sender: msg.sender,
          content: msg.content,
        })),
        reviews: reviews.map((item) => ({
          id: item.id,
          stage: item.stage,
          status: item.status,
          originalSuggestion: item.originalSuggestion,
          finalSuggestion: item.finalSuggestion,
        })),
      };

      await fetch("/api/saveContext", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId,
          data: exportData,
        }),
      });
    } catch (error) {
      console.error("同步写入后端失败:", error);
      message.error("自动同步 JSON 文件失败。");
    }
  };

  // 5. 新增：网页启动或刷新时，主动拉取目标路径下的 JSON 作为初始状态
  useEffect(() => {
    if (!userId) return;
    if (hasFetchedUserId.current === userId) return; // 避免开发环境 StrictMode 导致执行两次

    const fetchAssociatedData = async () => {
      hasFetchedUserId.current = userId; // 标记该用户的数据已经处于拉取过程或已完成
      try {
        const response = await fetch(
          `/jsons/ai_chat_context_${userId}.json?_t=${Date.now()}`,
        ); // 添加时间戳防止走浏览器缓存
        if (!response.ok) {
          throw new Error("HTTP state not OK");
        }
        const data = await response.json();

        // 解析如果成功，覆盖当前的 state 内容
        if (data.dialogues && Array.isArray(data.dialogues)) {
          setMessages(data.dialogues);
        }
        if (data.reviews && Array.isArray(data.reviews)) {
          setSuggestions(data.reviews);
        }
        dataLoadedForUserId.current = userId; // 标记该用户已经成功加载完
        message.success(
          `已自动加载与用户 ${userId} 关联的历史记录。对该记录所在文件的所有修改将全自动本地绑定并同步。`,
        );
      } catch (error) {
        message.info(
          `未发现用户 ${userId} 关联的文件，已重置为全新状态。后续对话将自动绑定创建该用户的 JSON 文件。`,
        );
        setMessages([defaultWelcomeMessage]);
        setSuggestions([]); // 同步清空 Review 面板内容
        dataLoadedForUserId.current = userId; // 使用默认状态，也是可以开始写入的状态
      }
    };

    fetchAssociatedData();
  }, [userId, setSuggestions]);

  // 6. 核心功能：生命周期监听与同步双写
  useEffect(() => {
    // 自动滚动到最新消息
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    // 同步备份到浏览器的 localStorage （仅备份对话）
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error("保存对话记录到缓存失败:", error);
    }

    // 静默同步写入后端（即本地物理硬盘中的 public/jsons 目录）
    if (userId) {
      writeToJsonFile(messages, suggestions);
    }
  }, [messages, suggestions, userId]);

  // 7. 移除原先的本地手动绑定（现在完全自动化）

  // 8. 接入 DeepSeek 大模型 API
  const fetchExternalAI = async (
    chatContext: Array<{ role: string; content: string }>,
  ): Promise<string> => {
    try {
      // 转换类型以符合 DeepSeek 接口要求
      const formattedContext: ChatMessage[] = chatContext.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      }));

      // 调用服务层获取回复
      const aiResponse = await fetchDeepSeekChat(formattedContext);
      return aiResponse;
    } catch (error: any) {
      console.error("AI 服务调用异常:", error);
      if (error.message.includes("API Key")) {
        message.warning("请配置有效的 API Key 以获得真实回复。");
        // 返回模拟回复以保证流程不中断 (仅为了演示，生产环境应抛出错误)
        return "【系统提示】检测到 API Key 未配置或无效。请检查 src/services/deepSeekService.ts 文件。";
      }
      throw error;
    }
  };

  // 9. 处理发送逻辑 (构建上下文并管理 Loading 状态)
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    // 前置校验：是否已输入编号
    if (!userId) {
      message.warning("请先登录或输入您的用户编号！");
      return;
    }

    const userText = inputValue;
    const newUserMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      content: userText,
    };

    // 构建发给 AI 的标准上下文数组
    const currentContext = messages.map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.content,
    }));
    currentContext.push({ role: "user", content: userText });

    // 更新 UI 状态
    setMessages((prev) => [...prev, newUserMsg]);
    setInputValue("");
    setIsLoading(true);

    // 结束计算打字时间埋点
    const typingDuration = typingStartTimeRef.current
      ? Date.now() - typingStartTimeRef.current
      : 0;
    typingStartTimeRef.current = null; // 重置

    trackerService.logEvent({
      module: "Dialogue",
      action: "action",
      duration: typingDuration,
      details: { type: "user_typing_duration", promptLength: userText.length },
    });

    try {
      let aiResponseText = await fetchExternalAI(currentContext);
      aiResponseText = aiResponseText.replace(/\*/g, "");
      aiResponseText = aiResponseText.trim();
      const newBotMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        content: aiResponseText,
      };
      setMessages((prev) => [...prev, newBotMsg]);

      // 检测回复中是否包含关键字以触发对应的页面数据读取
      if (
        aiResponseText.includes("可视化工作流") ||
        aiResponseText.includes("知识点可视化工作流")
      ) {
        // 请求模型提取15字总计内容
        const summaryMsg = await fetchTaskNameSummary(aiResponseText);

        // 获取当前任务名称
        const activeTask = taskFlowConfig.tasks.find(
          (t) => t.taskId === taskFlowConfig.currentTaskId,
        );
        const taskName = activeTask?.taskName || "";

        // 计算相似度
        const similarity = calculateSimilarity(summaryMsg, taskName);
        console.log(
          `[相似度验证] AI总结: "${summaryMsg}", 任务名称: "${taskName}", 相似度: ${(similarity * 100).toFixed(2)}%`,
        );

        if (similarity >= 0.6) {
          workflowController.startKnowledgePhase();
        } else {
          // 不匹配时作为AI助手回复一条提示
          const hintMsg: Message = {
            id: (Date.now() + 2).toString(),
            sender: "bot",
            content: `发现可能的知识点任务：“${summaryMsg}”。但该内容与当前任务设定 (${taskName}) 匹配度不足 (${(similarity * 100).toFixed(1)}%)。请您继续补充或明确知识点细节。`,
          };
          setMessages((prev) => [...prev, hintMsg]);
        }
      }
    } catch (error) {
      message.error("请求失败，请检查网络设置。");
    } finally {
      setIsLoading(false);
    }
  };

  // 10. 清空历史记录
  const handleClearHistory = () => {
    setMessages([defaultWelcomeMessage]);
    localStorage.removeItem(STORAGE_KEY);
    message.success("当前用户的对话历史已清空（云端自动同步重置）");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#fff",
      }}
    >
      {/* --- 顶部工具栏区 --- */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text type="secondary" strong>
          当前对话
        </Text>

        <div style={{ display: "flex", gap: "8px" }}>
          <Tooltip title="数据自动同步中，已绑定当前用户编号的 JSON 文件">
            <Button type="primary" size="small" icon={<SaveOutlined />}>
              JSON 自动同步中
            </Button>
          </Tooltip>

          {/* 
            TODO: 后续如果需要恢复清空历史功能，取消注释以下代码块即可
            
          <Popconfirm
            title="确定要清空所有当前页面的对话记录吗？"
            description="清空操作会清除页面当前显示的历史，云端/本地对应的文件也会随之清空。"
            onConfirm={handleClearHistory}
            okText="确认清空"
            cancelText="取消"
            placement="bottomRight"
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />}>
              清空历史
            </Button>
          </Popconfirm>
          */}
        </div>
      </div>

      {/* --- 消息流展示区 --- */}
      <div
        className="scroll-container"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          background: "#fafafa",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              marginBottom: "16px",
              flexDirection: msg.sender === "user" ? "row-reverse" : "row",
              alignItems: "flex-start",
            }}
          >
            <Avatar
              icon={
                msg.sender === "user" ? <UserOutlined /> : <RobotOutlined />
              }
              style={{
                backgroundColor: msg.sender === "user" ? "#1677ff" : "#52c41a",
                marginLeft: msg.sender === "user" ? "12px" : "0",
                marginRight: msg.sender === "bot" ? "12px" : "0",
                flexShrink: 0,
              }}
            />
            <div
              style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor: msg.sender === "user" ? "#e6f4ff" : "#ffffff",
                border: "1px solid #f0f0f0",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                wordWrap: "break-word",
                textAlign: "left",
              }}
            >
              <Text style={{ whiteSpace: "pre-wrap" }}>{msg.content}</Text>
            </div>
          </div>
        ))}
        {isLoading && (
          <div
            style={{
              display: "flex",
              marginBottom: "16px",
              flexDirection: "row",
              alignItems: "flex-start",
            }}
          >
            <Avatar
              icon={<RobotOutlined />}
              style={{
                backgroundColor: "#52c41a", // 与机器人头像保持一致
                marginRight: "12px",
                flexShrink: 0,
              }}
            />
            <div
              style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor: "#ffffff",
                border: "1px solid #f0f0f0",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                wordWrap: "break-word",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <LoadingOutlined />
              <Text type="secondary">正在思考中...</Text>
            </div>
          </div>
        )}
        {/* 用于自动定位到列表底部的锚点 */}
        <div ref={messagesEndRef} />
      </div>

      {/* --- 底部输入与发送区 --- */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid #f0f0f0",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <TextArea
            value={inputValue}
            onChange={(e) => {
              const val = e.target.value;
              setInputValue(val);
              // 当输入框内容从无到有，开始记录打字时间
              if (val.trim() !== "" && typingStartTimeRef.current === null) {
                typingStartTimeRef.current = Date.now();
              } else if (val === "") {
                // 如果用户清空了输入框，可以选择重置打字时间
                typingStartTimeRef.current = null;
              }
            }}
            placeholder={
              isLoading
                ? "AI 正在思考中，请稍候..."
                : "在这里输入对话指令 (Shift + Enter 换行)..."
            }
            disabled={isLoading}
            autoSize={{ minRows: 2, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            type="primary"
            onClick={handleSend}
            style={{ height: "auto" }}
            disabled={isLoading}
            icon={isLoading ? <LoadingOutlined /> : <SendOutlined />}
          >
            {isLoading ? "发送中" : "发送"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DialoguePanel;

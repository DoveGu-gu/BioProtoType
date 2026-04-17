// src/App.tsx
import React, { useState } from "react";
import {
  Layout,
  Typography,
  ConfigProvider,
  Modal,
  Input,
  message,
  Button,
  Steps,
} from "antd";
import zhCN from "antd/locale/zh_CN";
import { UserOutlined, LogoutOutlined } from "@ant-design/icons";
import DialoguePanel from "./modules/dialogue/DialoguePanel";
import WorkPanel from "./modules/work/WorkPanel";
import ReviewPanel from "./modules/review/ReviewPanel";
import { useAppStore } from "./store/useAppStore"; // 引入全局 Store
import "./App.css";

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const App: React.FC = () => {
  // --- 核心修改 1：获取 userId 及其设置方法 ---
  const {
    userId,
    setUserId,
    isKnowledgeTriggered,
    isScriptTriggered,
    isFrameTriggered,
    isAnimationTriggered,
    isFrameCompleted,
    isAnimationCompleted,
    isWorkflowCompleted,
  } = useAppStore();

  // 计算当前工作流的进度步数
  let currentStep = 0; // 默认开始在“对话”阶段
  if (isWorkflowCompleted)
    currentStep = 7; // 动画合成
  else if (isAnimationCompleted)
    currentStep = 6; // 动画审查
  else if (isAnimationTriggered)
    currentStep = 5; // 动画预览
  else if (isFrameCompleted)
    currentStep = 4; // 关键帧审查
  else if (isFrameTriggered)
    currentStep = 3; // 关键帧
  else if (isScriptTriggered)
    currentStep = 2; // 脚本
  else if (isKnowledgeTriggered) currentStep = 1; // 知识库

  // 临时状态，用于绑定弹窗内的输入框
  const [tempIdInput, setTempIdInput] = useState("");

  // 提交 ID 时的校验逻辑
  const handleIdSubmit = () => {
    // 强制正则校验：只允许输入纯数字
    const isNumeric = /^\d+$/.test(tempIdInput.trim());

    if (isNumeric) {
      setUserId(tempIdInput.trim());
      message.success(`成功绑定用户 ID: ${tempIdInput.trim()}`);
    } else {
      message.error("格式错误：用户 ID 必须是纯数字编号！");
    }
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ token: { colorPrimary: "#1677ff" } }}
    >
      {/* --- 核心修改 2：拦截式输入弹窗 --- */}
      <Modal
        title="初始化：请输入用户 ID"
        open={!userId} // 只要 userId 为空，弹窗就一直处于打开状态
        closable={false} // 禁用右上角关闭按钮
        keyboard={false} // 禁用 ESC 键关闭
        maskClosable={false} // 禁用点击遮罩层关闭
        onOk={handleIdSubmit}
        okText="确认并进入系统"
        cancelButtonProps={{ style: { display: "none" } }} // 隐藏取消按钮，强制必须输入
      >
        <div style={{ padding: "20px 0" }}>
          <Text
            type="secondary"
            style={{ display: "block", marginBottom: "12px" }}
          >
            请输入您的编号
          </Text>
          <Input
            size="large"
            prefix={<UserOutlined />}
            placeholder="请输入纯数字编号"
            value={tempIdInput}
            onChange={(e) => setTempIdInput(e.target.value)}
            onPressEnter={handleIdSubmit} // 支持按回车提交
          />
        </div>
      </Modal>

      {/* 主体界面布局 */}
      <Layout
        className="main-layout"
        style={{ height: "100vh", overflow: "hidden" }}
      >
        {/* 顶部标题栏 */}
        <Header
          className="app-header"
          style={{
            background: "#fff",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            position: "relative",
          }}
        >
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <Title level={3} style={{ margin: 0 }}>
              BioPrototype
            </Title>
          </div>

          {/* --- 新增：工作流进度条 --- */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              width: "70%",
              maxWidth: 600,
              minWidth: 500,
              marginTop: "12px", // 调整上下居中
            }}
          >
            <Steps
              current={currentStep}
              style={{ width: "100%" }}
              progressDot={(_, { status }) => (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    // 只有当前进行中的阶段显示为蓝色，已完成的改为绿色（或保持蓝色，但当前阶段加边框以示区分，这里按要求突出蓝色）
                    backgroundColor:
                      status === "process"
                        ? "#1677ff" // 蓝色：进行中
                        : status === "finish"
                          ? "#52c41a" // 绿色：已完成
                          : "#d9d9d9", // 灰色：未开始
                    boxShadow:
                      status === "process"
                        ? "0 0 0 3px rgba(22, 119, 255, 0.2)"
                        : "none",
                    marginTop: "-3px", // 修复点和线束的极小高度对齐差
                  }}
                />
              )}
              items={[
                {
                  title: (
                    <div
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: "14px",
                        marginTop: "-4px",
                      }}
                    >
                      对话
                    </div>
                  ),
                },
                {
                  title: (
                    <div
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: "14px",
                        marginTop: "-4px",
                      }}
                    >
                      知识库
                    </div>
                  ),
                },
                {
                  title: (
                    <div
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: "14px",
                        marginTop: "-4px",
                      }}
                    >
                      脚本
                    </div>
                  ),
                },
                {
                  title: (
                    <div
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: "14px",
                        marginTop: "-4px",
                      }}
                    >
                      关键帧
                    </div>
                  ),
                },
                {
                  title: (
                    <div
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: "14px",
                        marginTop: "-4px",
                      }}
                    >
                      关键帧审查
                    </div>
                  ),
                },
                {
                  title: (
                    <div
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: "14px",
                        marginTop: "-4px",
                      }}
                    >
                      动画预览
                    </div>
                  ),
                },
                {
                  title: (
                    <div
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: "14px",
                        marginTop: "-4px",
                      }}
                    >
                      动画审查
                    </div>
                  ),
                },
                {
                  title: (
                    <div
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: "14px",
                        marginTop: "-4px",
                      }}
                    >
                      动画合成
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* --- 核心修改 3：在右上角展示当前 ID，并提供重置选项 --- */}
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            {userId && (
              <div
                style={{ display: "flex", alignItems: "center", gap: "16px" }}
              >
                <Text type="secondary">
                  当前用户编号: <Text strong>{userId}</Text>
                </Text>
                <Button
                  size="small"
                  type="text"
                  icon={<LogoutOutlined />}
                  onClick={() => {
                    setUserId(null); // 清空 ID 将重新触发弹窗
                    setTempIdInput("");
                  }}
                >
                  切换用户
                </Button>
              </div>
            )}
          </div>
        </Header>

        <Layout style={{ flex: 1, overflow: "hidden" }}>
          <Sider
            width={420}
            theme="light"
            style={{ borderRight: "1px solid #f0f0f0", height: "100%" }}
          >
            <DialoguePanel />
          </Sider>
          <Content
            className="work-content"
            style={{
              background: "#f5f5f5",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <WorkPanel />
          </Content>
          <Sider
            width={420}
            theme="light"
            style={{ borderLeft: "1px solid #f0f0f0", height: "100%" }}
          >
            <ReviewPanel />
          </Sider>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default App;

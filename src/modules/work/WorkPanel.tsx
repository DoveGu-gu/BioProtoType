// src/modules/work/WorkPanel.tsx
import React, { useEffect } from "react";
import { Tabs, Badge } from "antd";
import { useAppStore } from "../../store/useAppStore";
import { trackerService } from "../../services/trackerService";
import { workflowController } from "../../controllers/workflowController";
import KnowledgePage from "./KnowledgePage";
import ScriptPage from "./ScriptPage";
import FramePage from "./FramePage";
import AnimationPage from "./AnimationPage";

//
const WorkPanel: React.FC = () => {
  const {
    activeWorkTabKey,
    setActiveWorkTabKey,
    showKnowledgeHighlight,
    showScriptHighlight,
    showFrameHighlight,
    showAnimationHighlight,
  } = useAppStore();

  // 当用户点击 Knowledge 时，清除高亮标记
  const handleTabChange = (key: string) => {
    setActiveWorkTabKey(key);
    workflowController.resolveHighlight(key);
  };

  // 添加埋点：记录 Work 模块各页面的停留时间
  useEffect(() => {
    // 页面进入埋点并开始计时
    trackerService.startTimer(`Work_${activeWorkTabKey}`);
    trackerService.logEvent({
      module: "Work",
      page: activeWorkTabKey,
      action: "enter",
    });

    return () => {
      // 页面离开埋点并计算停留时间
      const duration = trackerService.stopTimer(`Work_${activeWorkTabKey}`);
      if (duration > 0) {
        trackerService.logEvent({
          module: "Work",
          page: activeWorkTabKey,
          action: "leave",
          duration,
        });
      }
    };
  }, [activeWorkTabKey]);

  const knowledgeLabel = (
    <Badge dot={showKnowledgeHighlight} offset={[5, 0]}>
      <span
        style={
          showKnowledgeHighlight ? { color: "#1677ff", fontWeight: "bold" } : {}
        }
      >
        Knowledge
      </span>
    </Badge>
  );

  const scriptLabel = (
    <Badge dot={showScriptHighlight} offset={[5, 0]}>
      <span
        style={
          showScriptHighlight ? { color: "#1677ff", fontWeight: "bold" } : {}
        }
      >
        Script
      </span>
    </Badge>
  );

  const frameLabel = (
    <Badge dot={showFrameHighlight} offset={[5, 0]}>
      <span
        style={
          showFrameHighlight ? { color: "#1677ff", fontWeight: "bold" } : {}
        }
      >
        Frame
      </span>
    </Badge>
  );

  const animationLabel = (
    <Badge dot={showAnimationHighlight} offset={[5, 0]}>
      <span
        style={
          showAnimationHighlight ? { color: "#1677ff", fontWeight: "bold" } : {}
        }
      >
        Animation
      </span>
    </Badge>
  );

  const items = [
    { key: "knowledge", label: knowledgeLabel, children: <KnowledgePage /> },
    { key: "script", label: scriptLabel, children: <ScriptPage /> },
    { key: "frame", label: frameLabel, children: <FramePage /> },
    { key: "animation", label: animationLabel, children: <AnimationPage /> },
  ];

  return (
    // 核心修改：让外层容器填满父级 (Content)，并采用 Flex 纵向布局
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      <Tabs
        activeKey={activeWorkTabKey}
        onChange={handleTabChange}
        centered
        items={items}
        // 核心修改：利用全局样式或行内样式强制覆写 Antd Tabs 的高度计算
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
        // 让 tab 切换面板区域占据剩余空间
        tabBarStyle={{ marginBottom: 0, padding: "12px 16px 0" }}
        // 给 children 挂载区域设定弹性满高
        className="work-tabs-container"
      />
    </div>
  );
};

export default WorkPanel;

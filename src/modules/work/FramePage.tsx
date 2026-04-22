import React, { useState, useEffect } from "react";
import { Typography, Empty, Spin } from "antd";
import { fetchFrameData, type KeyframeData } from "./data/frameData";
import { trackerService } from "../../services/trackerService";
import { useAppStore } from "../../store/useAppStore";

const { Text } = Typography;

import { workflowController } from "../../controllers/workflowController";
import taskFlowConfig from "../../config/taskFlowConfig.json";
import { fetchAllFrameData } from "./data/frameData";

const FramePage: React.FC = () => {
  const {
    activeWorkTabKey,
    isFrameTriggered,
    addReadyEntity,
    approvedReplacements,
  } = useAppStore();
  const [keyframes, setKeyframes] = useState<KeyframeData[]>([]);
  const [allFrameSourceList, setAllFrameSourceList] = useState<KeyframeData[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [selectedFrameId, setSelectedFrameId] = useState<string>("");

  // 新增：用于记录每张图片渲染进度的状态
  // "pending": 等待生成（不显示图片）
  // "generating": 正在生成（显示加载动画或骨架屏）
  // "ready": 生成完成（显示图片内容）
  const [frameStatuses, setFrameStatuses] = useState<
    Record<string, "pending" | "generating" | "ready">
  >({});

  // 第一次伪加载：页面级加载
  useEffect(() => {
    if (isFrameTriggered && keyframes.length === 0) {
      setLoading(true);
      // Frame的伪随机时长15-20s
      // TODO: Frame页面的伪随机时长,15-20s
      const randomDelay = Math.floor(Math.random() * (20000 - 15000 + 1)) + 0;

      const timer = setTimeout(() => {
        const activeTask = taskFlowConfig.tasks.find(
          (t) => t.taskId === taskFlowConfig.currentTaskId,
        );
        const rawFrames = activeTask?.allResourcesList.frames;
        let frameIds: string[] = rawFrames
          ? Array.isArray(rawFrames)
            ? rawFrames
            : [rawFrames]
          : [];

        const state = useAppStore.getState();
        // 使用来自 Script 阶段关联传递过来的关键帧 ID
        if (
          state.activeLinkedFrameIds &&
          state.activeLinkedFrameIds.length > 0
        ) {
          frameIds = state.activeLinkedFrameIds;
        }

        /*
        // 注释分支机制逻辑
        if (activeTask && activeBranchId) {
          const branch = activeTask.branchs?.find(
            (b) => b.id === activeBranchId,
          );
          if (branch) {
            frameIds = branch.resourcesList.frames;
          }
        }
        */

        // 并行加载全部资源（用于替换）以及当前任务指定的帧
        Promise.all([fetchAllFrameData(), fetchFrameData(frameIds)])
          .then(([allData, data]) => {
            // 保存所有的原始数据，用于后续替换
            setAllFrameSourceList(allData.keyframes);

            // 初始化：根据 task.json 中的帧进行预排序
            const initKeyframes = data.sort((a, b) =>
              a.frameId.localeCompare(b.frameId, undefined, { numeric: true }),
            );
            setKeyframes(initKeyframes);

            // 初始化所有帧状态为“等待生成”
            const initialStatuses: Record<string, "pending"> = {};

            initKeyframes.forEach((k) => {
              initialStatuses[k.id] = "pending";
            });
            setFrameStatuses(initialStatuses);

            useAppStore
              .getState()
              .setActiveRenderedFrameIds(initKeyframes.map((k) => k.id));

            if (initKeyframes.length > 0) {
              setSelectedFrameId(initKeyframes[0].id);
            }
          })
          .catch((err) => console.error("加载关键帧失败:", err))
          .finally(() => setLoading(false));
      }, randomDelay);

      return () => clearTimeout(timer);
    }
  }, [isFrameTriggered, keyframes.length]);

  // 第二次伪加载：逐条对预览图进行伪装渲染
  useEffect(() => {
    if (keyframes.length === 0 || loading) return;

    // 检查当前是否有正处于“generating”阶段的帧
    const currentGenerating = keyframes.find(
      (k) => frameStatuses[k.id] === "generating",
    );

    if (currentGenerating) {
      // TODO: 每张图的伪随机时长,30-60s
      const randomGenDelay =
        Math.floor(Math.random() * (30002 - 30000 + 1)) + 0;

      const timer = setTimeout(() => {
        setFrameStatuses((prev) => ({
          ...prev,
          [currentGenerating.id]: "ready",
        }));
        addReadyEntity(currentGenerating.id);
      }, randomGenDelay);

      return () => clearTimeout(timer);
    } else {
      // 否则寻找下一张处于“pending”的图片并使其进入“generating”状态
      const nextPending = keyframes.find(
        (k) => frameStatuses[k.id] === "pending",
      );
      if (nextPending) {
        setFrameStatuses((prev) => ({
          ...prev,
          [nextPending.id]: "generating",
        }));
      } else {
        // 如果全完成了，检测是否所有的都ready
        const allReady = keyframes.every(
          (k) => frameStatuses[k.id] === "ready",
        );
        if (allReady && keyframes.length > 0) {
          // 只标记 Frame 渲染完成，不在这里触发 Animation 逻辑
          workflowController.completeFramePhase(true);
        }
      }
    }
  }, [keyframes, loading, frameStatuses]);

  // --- 新增：监听 Review 面板通过的已批准替换建议并做出响应 ---
  useEffect(() => {
    if (keyframes.length === 0 || allFrameSourceList.length === 0) return;

    let hasChange = false;
    const nextKeyframes = [...keyframes];
    const nextStatuses = { ...frameStatuses };

    keyframes.forEach((kf, index) => {
      const newId = approvedReplacements[kf.id];
      if (newId) {
        if (newId === "DELETE") {
          (nextKeyframes[index] as any) = null;
          delete nextStatuses[kf.id];
          hasChange = true;

          // 若恰好选中此帧则置空
          if (selectedFrameId === kf.id) {
            setSelectedFrameId(null);
          }
        } else {
          const replacementFrame = allFrameSourceList.find(
            (f) => f.id === newId,
          );
          if (replacementFrame && replacementFrame.id !== kf.id) {
            nextKeyframes[index] = replacementFrame;
            // 新进入替换的关键帧，将其置为“generating”展现重新加载的动画
            nextStatuses[replacementFrame.id] = "generating";
            // 移除旧记录
            delete nextStatuses[kf.id];
            hasChange = true;

            // 保持选中态跟随
            if (selectedFrameId === kf.id) {
              setSelectedFrameId(replacementFrame.id);
            }
          }
        }
      }
    });

    if (hasChange) {
      const filteredKeyframes = nextKeyframes
        .filter(Boolean)
        .sort((a: any, b: any) =>
          a.frameId.localeCompare(b.frameId, undefined, { numeric: true }),
        );
      setKeyframes(filteredKeyframes);
      setFrameStatuses(nextStatuses);

      // 更新全局
      useAppStore
        .getState()
        .setActiveRenderedFrameIds(filteredKeyframes.map((k: any) => k.id));

      workflowController.completeFramePhase(false); // 新增：既然状态退回“generating”，那就尚未完成
    }
  }, [
    approvedReplacements,
    allFrameSourceList,
    keyframes,
    frameStatuses,
    selectedFrameId,
  ]);

  const isActive = activeWorkTabKey === "frame";

  useEffect(() => {
    if (!selectedFrameId || !isActive) return;

    // 当用户选择一张 frame 时，且当前选中了 frame 面板，开始计时，并记录进入事件
    const timerId = `Work_FramePage_Frame_${selectedFrameId}`;
    trackerService.startTimer(timerId);

    trackerService.logEvent({
      module: "Work",
      page: "frame",
      action: "enter",
      details: {
        type: "view_frame",
        frameId: selectedFrameId,
      },
    });

    return () => {
      // 当发生用户切换选择其他 frame、或切出 frame 面板、或组件卸载时，清算并记录离开事件及持续时间
      const duration = trackerService.stopTimer(timerId);
      if (duration > 0) {
        trackerService.logEvent({
          module: "Work",
          page: "frame",
          action: "leave",
          duration,
          details: {
            type: "view_frame",
            frameId: selectedFrameId,
          },
        });
      }
    };
  }, [selectedFrameId, isActive]);

  const currentFrame = keyframes.find((k) => k.id === selectedFrameId);

  if (!isFrameTriggered && keyframes.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <Empty description="关键帧尚未生成，等待事件脚本生成" />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <Spin size="large" tip="Frame 页面环境加载中 (约15~20s).." />
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        overflow: "hidden",
      }}
    >
      {/* --- 上方：关键帧图像展示区 (Light Grey Hint) --- */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: "#f5f5f5", // 浅灰背景
          borderRadius: "8px",
          border: "1px solid #e6e6e6",
          padding: "16px",
          overflow: "hidden",
        }}
      >
        <Text
          strong
          style={{
            fontSize: "16px",
            color: "#1f1f1f",
            marginBottom: "12px",
            display: "block",
            flexShrink: 0,
          }}
        >
          关键帧图像预览
        </Text>

        <div
          style={{
            flex: 1,
            background: "#fff",
            borderRadius: "6px",
            border: "1px solid #e6e6e6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {currentFrame ? (
            <div
              style={{
                height: "100%",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                padding: "16px",
                boxSizing: "border-box",
              }}
            >
              {frameStatuses[currentFrame.id] === "ready" ? (
                // 16:9 比例容器：图片已就绪
                <div
                  style={{
                    height: "100%",
                    width: "100%",
                    maxHeight: "100%",
                    aspectRatio: "16 / 9",
                    backgroundImage: `url("${currentFrame.imageUrl}")`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    display: "flex",
                    flexDirection: "column",
                  }}
                />
              ) : frameStatuses[currentFrame.id] === "generating" ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    width: "100%",
                    aspectRatio: "16 / 9",
                  }}
                >
                  <Spin size="large" tip="图像渲染中..." />
                </div>
              ) : (
                <Empty description="等待渲染..." />
              )}
            </div>
          ) : (
            <Empty description="暂无选中的关键帧" />
          )}
        </div>
      </div>

      {/* --- 下方：关键帧概览区 (Light Grey Hint) --- */}
      <div
        style={{
          height: "300px", // 再次增加高度 (240px * 1.25 = 300px)
          display: "flex",
          flexDirection: "column",
          background: "#f5f5f5", // 浅灰背景
          borderRadius: "8px",
          border: "1px solid #e6e6e6",
          padding: "12px",
          flexShrink: 0,
        }}
      >
        <Text
          strong
          style={{
            fontSize: "16px",
            color: "#1f1f1f",
            marginBottom: "10px",
            display: "block",
            flexShrink: 0,
          }}
        >
          关键帧预览序列
        </Text>

        <div
          className="scroll-container"
          style={{
            flex: 1,
            display: "flex", // 确保内容横向排列
            gap: "12px",
            overflowX: "auto", // 横向滚动
            overflowY: "hidden",
            paddingBottom: "4px", // 避免滚动条挡住内容底部
          }}
        >
          {keyframes.map((frame) => {
            const isSelected = frame.id === selectedFrameId;
            return (
              <div
                key={frame.id}
                onClick={() => setSelectedFrameId(frame.id)}
                style={{
                  // 宽度调大以适应 16:9 比例
                  flex: "0 0 280px",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  background: "#fff",
                  borderRadius: "6px",
                  border: isSelected
                    ? "2px solid #1677ff"
                    : "1px solid #d9d9d9",
                  cursor: "pointer",
                  overflow: "hidden",
                  transition: "all 0.2s",
                  boxShadow: isSelected
                    ? "0 2px 8px rgba(22, 119, 255, 0.15)"
                    : "none",
                }}
              >
                {/* 缩略图区域：强制 16:9 */}
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    backgroundColor:
                      frameStatuses[frame.id] === "ready"
                        ? frame.color
                        : "#d9d9d9",
                    backgroundImage:
                      frameStatuses[frame.id] === "ready"
                        ? `url("${frame.imageUrl}")`
                        : "none",
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {frameStatuses[frame.id] === "ready" ? (
                    <Text
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "rgba(255,255,255,0.8)",
                        userSelect: "none",
                        textShadow: "1px 1px 4px rgba(0,0,0,0.8)",
                      }}
                    >
                      {frame.frameId}
                    </Text>
                  ) : frameStatuses[frame.id] === "generating" ? (
                    <Spin size="small" />
                  ) : (
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      等待渲染...
                    </Text>
                  )}
                </div>
                {/* 文本信息区域 */}
                <div
                  style={{
                    flex: 1, // 占据剩余空间
                    padding: "12px",
                    background: isSelected ? "#e6f4ff" : "#fff",
                    borderTop: "1px solid #f0f0f0",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    strong={isSelected}
                    ellipsis={true}
                    style={{
                      display: "block", // 必须是 block 才能 ellipsis
                      fontSize: "14px",
                      color: isSelected ? "#1677ff" : "#333",
                      marginBottom: "4px",
                    }}
                  >
                    {frame.title}
                  </Text>
                  <Text
                    type="secondary"
                    style={{ fontSize: "12px" }}
                    ellipsis={true}
                  >
                    {frame.description}
                  </Text>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FramePage;

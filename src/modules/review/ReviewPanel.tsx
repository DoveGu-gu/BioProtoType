// src/modules/review/ReviewPanel.tsx
import React, { useState, useMemo, useEffect } from "react";
import { Input, Button, Space, Typography, message, Spin } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import ReviewSuggestionCard from "./ReviewSuggestionCard";
import { useAppStore } from "../../store/useAppStore"; //
import { trackerService } from "../../services/trackerService"; // 引入数据埋点服务
import { fetchReviewData } from "./data/reviewData";
import taskFlowConfig from "../../config/taskFlowConfig.json";

const { TextArea } = Input;
const { Title, Text } = Typography;

import { workflowController } from "../../controllers/workflowController";

const ReviewPanel: React.FC = () => {
  //const { suggestions, updateSuggestion } = useAppStore();

  const {
    suggestions,
    updateSuggestion,
    addSuggestion,
    setSuggestions,
    readyEntities,
    addApprovedReplacement,
    removeReadyEntity,
    isKnowledgeTriggered,
    isScriptTriggered,
    isFrameTriggered,
    isFrameCompleted,
    isAnimationTriggered,
    isAnimationCompleted,
    isWorkflowCompleted,
  } = useAppStore();

  // 根据与App.tsx相同的逻辑计算当前阶段
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

  const [userComment, setUserComment] = useState("");
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<
    string | null
  >(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // 用于暂存还未触发条件展示的建议数据
  const [pendingSuggestions, setPendingSuggestions] = useState<any[]>([]);
  // 正在延迟展示过程中的建议（从 pending 挪出，但还未 addSuggestion）
  const [delayingSuggestions, setDelayingSuggestions] = useState<any[]>([]);
  // 正在处理动作反馈过渡中的建议项 ID
  const [processingSuggestionIds, setProcessingSuggestionIds] = useState<
    string[]
  >([]);

  // 模拟从 JSON 文件获取建议数据并初始化到 store 中
  useEffect(() => {
    setInitialLoading(true);
    const activeTask = taskFlowConfig.tasks.find(
      (t) => t.taskId === taskFlowConfig.currentTaskId,
    );
    let reviewIds: string[] = [];
    if (activeTask) {
      const rawReviews = activeTask.allResourcesList.reviews;
      reviewIds = rawReviews
        ? Array.isArray(rawReviews)
          ? rawReviews
          : [rawReviews]
        : [];
    }

    /*
    // 注释分支机制逻辑
    if (activeTask) {
      if (activeBranchId) { ... }
    }
    */

    fetchReviewData(reviewIds)
      .then((data) => {
        const immediateSuggestions: any[] = [];
        const delayedSuggestions: any[] = [];

        const activeTask = taskFlowConfig.tasks.find(
          (t) => t.taskId === taskFlowConfig.currentTaskId,
        );
        const frameLimit = activeTask?.reviewsCount?.Frame ?? 1;
        const animLimit = activeTask?.reviewsCount?.Animation ?? 1;
        const moduleCounts: Record<string, number> = { Frame: 0, Animation: 0 };
        const initialExcludedIds = new Set<string>();

        data.forEach((item, index) => {
          const formatted = {
            id: item.id || `review_item_${Date.now()}_${index}`,
            stage: item.stage,
            relatedModule: item.relatedModule,
            status: "未处理" as "未处理",
            originalSuggestion: item.originalSuggestion,
            finalSuggestion: "",
            linkedContent: item.linkedContent,
            triggerSource: item.triggerSource,
            processedResult: item.processedResult,
            exclusion: item.exclusion,
          };

          // 如果有前置触发源，先保留不直接显示
          if (item.triggerSource) {
            delayedSuggestions.push({
              ...formatted,
              triggerSource: item.triggerSource,
            });
            // 即使是延迟展示的，只要进入了待定列表，其互斥项也应被全量排除
            if (item.exclusion) {
              item.exclusion.forEach((exId: string) =>
                initialExcludedIds.add(exId),
              );
            }
          } else {
            // 对 immediate 立即显示的建议才应用互斥排除
            if (initialExcludedIds.has(item.id)) return;

            // 对 immediate 立即显示的建议也应用数量限制
            const moduleName = item.relatedModule;
            let canAdd = true;
            if (moduleName) {
              const limit =
                moduleName === "Frame"
                  ? frameLimit
                  : moduleName === "Animation"
                    ? animLimit
                    : Infinity;
              if (moduleCounts[moduleName] >= limit) {
                canAdd = false;
              } else {
                moduleCounts[moduleName] += 1;
              }
            }

            if (canAdd) {
              immediateSuggestions.push(formatted);
              if (item.exclusion) {
                item.exclusion.forEach((exId: string) =>
                  initialExcludedIds.add(exId),
                );
              }
            }
          }
        });

        setSuggestions(immediateSuggestions);
        setPendingSuggestions(delayedSuggestions);
        setHasLoaded(true);
      })
      .catch((err) => {
        console.error("加载审核建议数据失败:", err);
      })
      .finally(() => {
        setInitialLoading(false);
      });
  }, [setSuggestions, taskFlowConfig.currentTaskId]);

  // 监听并处理来自 KeyFrame 或 Animation 的延迟展示建议
  useEffect(() => {
    if (pendingSuggestions.length > 0 && readyEntities.length > 0) {
      const activeTask = taskFlowConfig.tasks.find(
        (t) => t.taskId === taskFlowConfig.currentTaskId,
      );
      const frameLimit = activeTask?.reviewsCount?.Frame ?? 1;
      const animLimit = activeTask?.reviewsCount?.Animation ?? 1;

      const matchItems = pendingSuggestions.filter(
        (s) =>
          s.triggerSource &&
          s.triggerSource.every((id: string) => readyEntities.includes(id)),
      );

      // --- 拦截判断：如果某个 stage (relatedModule) 相关建议已展示或准备展示的数量达到了上限，则不再推入新建议 ---
      const moduleCounts: Record<string, number> = {
        Frame:
          suggestions.filter((s) => s.relatedModule === "Frame").length +
          delayingSuggestions.filter((s) => s.relatedModule === "Frame").length,
        Animation:
          suggestions.filter((s) => s.relatedModule === "Animation").length +
          delayingSuggestions.filter((s) => s.relatedModule === "Animation")
            .length,
      };

      // 记录所有互斥的且已被触发或即将被触发的ID
      const currentExcludedIds = new Set<string>();

      // 先将已存在或处理中建议的 exclusion 和自身 ID 加入到集合中，确保所有建议项只出现一次
      [...suggestions, ...delayingSuggestions].forEach((s) => {
        if (s.id) currentExcludedIds.add(s.id);
        if (s.exclusion && Array.isArray(s.exclusion)) {
          s.exclusion.forEach((exId: string) => currentExcludedIds.add(exId));
        }
      });

      const validMatchItems = matchItems.filter((item) => {
        // 如果当前项的 ID 在互斥列表内，则不予展示
        if (currentExcludedIds.has(item.id)) return false;

        const moduleName = item.relatedModule;
        if (!moduleName) {
          if (item.exclusion && Array.isArray(item.exclusion)) {
            item.exclusion.forEach((exId: string) =>
              currentExcludedIds.add(exId),
            );
          }
          return true;
        }

        const limit =
          moduleName === "Frame"
            ? frameLimit
            : moduleName === "Animation"
              ? animLimit
              : Infinity;

        if (moduleCounts[moduleName] >= limit) return false;

        // 如果还可以推入，则更新计数以防止同批次的推入超过上限
        moduleCounts[moduleName] += 1;
        // 推入成功，将其包含的互斥 ID 追加进排除集合
        if (item.exclusion && Array.isArray(item.exclusion)) {
          item.exclusion.forEach((exId: string) =>
            currentExcludedIds.add(exId),
          );
        }
        return true;
      });

      // 注：虽然有的项目被拦截抛弃不展示，我们依然要把这些匹配过触发源的从 pending 中移除，以免不停重复检测
      if (matchItems.length > 0) {
        setPendingSuggestions((prev) =>
          prev.filter(
            (s) =>
              !(
                s.triggerSource &&
                s.triggerSource.every((id: string) =>
                  readyEntities.includes(id),
                )
              ),
          ),
        );

        validMatchItems.forEach((item) => {
          setDelayingSuggestions((prev) => [...prev, item]);
          const randomDelay =
            Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
          setTimeout(() => {
            setDelayingSuggestions((prev) =>
              prev.filter((i) => i.id !== item.id),
            );

            // 新增：在延迟结束准备推入 suggestions 时，检查其依赖是否仍然有效
            const currentReadyEntities = useAppStore.getState().readyEntities;
            const isStillValid = item.triggerSource
              ? item.triggerSource.every((id: string) =>
                  currentReadyEntities.includes(id),
                )
              : true;

            if (isStillValid) {
              addSuggestion({
                id: item.id,
                stage: item.stage,
                relatedModule: item.relatedModule,
                originalSuggestion: item.originalSuggestion,
                linkedContent: item.linkedContent,
                triggerSource: item.triggerSource,
                processedResult: item.processedResult,
                exclusion: item.exclusion,
              });
              message.info(
                `系统产生了一条针对 [${item.triggerSource?.join(", ")}] 分析触发的修改建议`,
              );
            }
          }, randomDelay);
        });
      }
    }
  }, [
    readyEntities,
    pendingSuggestions,
    addSuggestion,
    suggestions,
    delayingSuggestions,
  ]);

  // --- 新增：监控 Frame 阶段所有模块的建议是否都被处理完成，如果是则触发 Animation ---
  useEffect(() => {
    // 只有在 Frame 相关的预处理完成(渲染完成)之后才开始进行检查
    if (isFrameCompleted && hasLoaded && !isAnimationTriggered) {
      const activeTask = taskFlowConfig.tasks.find(
        (t) => t.taskId === taskFlowConfig.currentTaskId,
      );
      // 获取配置中 Frame 允许展示和处理的建议上限（默认 1）
      const frameLimit = activeTask?.reviewsCount?.Frame ?? 1;

      const hasUnhandledFrame = suggestions.some(
        (s) => s.relatedModule === "Frame" && s.status === "未处理",
      );
      const hasProcessingFrame = processingSuggestionIds.some((id) => {
        const s = suggestions.find((item) => item.id === id);
        return s?.relatedModule === "Frame";
      });
      // 新增：检查是否有被触发但处于延迟展示队列中的项
      const hasDelayingFrame = delayingSuggestions.some(
        (s) => s.relatedModule === "Frame",
      );

      // 统计所有已明确处理的 Frame 建议数量
      const processedFrameCount = suggestions.filter(
        (s) => s.relatedModule === "Frame" && s.status !== "未处理",
      ).length;

      const hasPendingFrame = pendingSuggestions.some(
        (s) => s.relatedModule === "Frame",
      );

      // 新增：判断队列中剩余的待触发项是否还有能在当前实体状态下被触发的可能性
      const hasTriggerablePendingFrame = pendingSuggestions.some(
        (s) =>
          s.relatedModule === "Frame" &&
          s.triggerSource &&
          s.triggerSource.every((id: string) => readyEntities.includes(id)),
      );

      const noActiveFrameWork =
        !hasUnhandledFrame && !hasProcessingFrame && !hasDelayingFrame;

      // 判断能否进入下一阶段：当前屏幕上不能有活动中的/延迟等待的项
      if (noActiveFrameWork) {
        // 如果处理数已达配置上限，或者潜在的没触发项已经全无，或者剩下的没触发项根本无法基于当前条件触发（陷入静息态等不到新触发），才安全进入下一阶段
        if (
          processedFrameCount >= frameLimit ||
          !hasPendingFrame ||
          !hasTriggerablePendingFrame
        ) {
          workflowController.startAnimationPhase();
        }
      }
    }
  }, [
    isFrameCompleted,
    hasLoaded,
    isAnimationTriggered,
    suggestions,
    processingSuggestionIds,
    delayingSuggestions,
    pendingSuggestions,
    readyEntities,
  ]);

  // --- 新增：监控 Animation 阶段所有模块的建议是否都被处理完成，如果是则开放下载 / 结束工作流 ---

  useEffect(() => {
    // 只有在 Animation 相关的预处理渲染完成之后才开始进行检查
    if (isAnimationCompleted && hasLoaded && !isWorkflowCompleted) {
      const activeTask = taskFlowConfig.tasks.find(
        (t) => t.taskId === taskFlowConfig.currentTaskId,
      );
      // 获取配置中 Animation 允许展示和处理的建议上限（默认 1）
      const animLimit = activeTask?.reviewsCount?.Animation ?? 1;

      const hasUnhandledAnim = suggestions.some(
        (s) => s.relatedModule === "Animation" && s.status === "未处理",
      );
      const hasProcessingAnim = processingSuggestionIds.some((id) => {
        const s = suggestions.find((item) => item.id === id);
        return s?.relatedModule === "Animation";
      });
      // 新增：检查是否有被触发但处于延迟展示队列中的项
      const hasDelayingAnim = delayingSuggestions.some(
        (s) => s.relatedModule === "Animation",
      );

      const processedAnimCount = suggestions.filter(
        (s) => s.relatedModule === "Animation" && s.status !== "未处理",
      ).length;

      const hasPendingAnim = pendingSuggestions.some(
        (s) => s.relatedModule === "Animation",
      );

      // 新增：判断剩余动画建议是否还能被当前状态触发
      const hasTriggerablePendingAnim = pendingSuggestions.some(
        (s) =>
          s.relatedModule === "Animation" &&
          s.triggerSource &&
          s.triggerSource.every((id: string) => readyEntities.includes(id)),
      );

      const noActiveAnimWork =
        !hasUnhandledAnim && !hasProcessingAnim && !hasDelayingAnim;

      if (noActiveAnimWork) {
        if (
          processedAnimCount >= animLimit ||
          !hasPendingAnim ||
          !hasTriggerablePendingAnim
        ) {
          workflowController.completeWorkflow(true);
          // 这里可以给用户弹个窗提示，但可能会比较突然，可以考虑只在右侧提示
          message.success(
            "所有阶段审查均已完成，系统工作流结束可进行下载！",
            5,
          );
        }
      }
    }
  }, [
    isAnimationCompleted,
    hasLoaded,
    isWorkflowCompleted,
    suggestions,
    processingSuggestionIds,
    delayingSuggestions,
    pendingSuggestions,
    readyEntities,
  ]);

  // 监听选中项变化，记录审核时长
  useEffect(() => {
    if (!selectedSuggestionId) return;

    const timerId = `Review_Process_${selectedSuggestionId}`;
    trackerService.startTimer(timerId);

    return () => {
      const duration = trackerService.stopTimer(timerId);
      if (duration > 0) {
        // 利用闭包特性，获取这期间最新的建议状态判断是否已处理
        const currentSuggestion = useAppStore
          .getState()
          .suggestions.find((s) => s.id === selectedSuggestionId);

        trackerService.logEvent({
          module: "Review",
          action: "action",
          duration,
          details: {
            type: "review_duration",
            suggestionId: selectedSuggestionId,
            handled: currentSuggestion
              ? currentSuggestion.status !== "未处理"
              : false,
            finalStatus: currentSuggestion
              ? currentSuggestion.status
              : "unknown",
          },
        });
      }
    };
  }, [selectedSuggestionId]);

  // --- 新增：测试按钮的触发逻辑 ---
  const handleTestAdd = () => {
    const currentTime = new Date().toLocaleTimeString();
    addSuggestion({
      stage: "动画合成",
      originalSuggestion: `[测试 ${currentTime}] 发现部分音频轨道存在底噪，建议进行降噪处理。`,
    });
    message.info("已推送一条新的【未处理】建议");
  };

  const handleSuggestionClick = (id: string, text: string) => {
    setSelectedSuggestionId(id);
    setUserComment(text);
  };

  const handleAction = (targetStatus: "已确认" | "已拒绝") => {
    if (!selectedSuggestionId) {
      message.warning("请先在上方选择一项待处理的建议");
      return;
    }

    // 获取当前选中项的原始文本，用于用户清空输入框时的后备方案
    const currentItem = suggestions.find(
      (item) => item.id === selectedSuggestionId,
    );
    const trimmedComment = userComment.trim();
    let finalContent = "";

    if (targetStatus === "已确认") {
      finalContent =
        currentItem?.processedResult || currentItem?.originalSuggestion || "";
      // 允许保留用户的手动批注，但主干显示处理结果
      if (trimmedComment !== "") {
        finalContent += ` （批注: ${trimmedComment}）`;
      }
    } else {
      finalContent =
        trimmedComment !== ""
          ? trimmedComment
          : currentItem?.originalSuggestion || "";
    }

    // 调用全局方法更新状态
    updateSuggestion(selectedSuggestionId, targetStatus, finalContent);

    if (targetStatus === "已确认" && currentItem?.linkedContent) {
      // 记录该建议正处于处理加载过渡期
      setProcessingSuggestionIds((prev) => [...prev, selectedSuggestionId]);

      // 模拟加载关联内容
      message.loading({
        content: `正在处理 [${currentItem.linkedContent.join(", ")}]...`,
        key: `load_${selectedSuggestionId}`,
        duration: 2,
      });
      setTimeout(() => {
        message.success({
          content: `[${currentItem.linkedContent?.join(", ")}] 处理成功，已更新视图`,
          key: `load_${selectedSuggestionId}`,
          duration: 2,
        });

        // --- 新增：通知 Store 记录替换映射 ---
        // 我们利用 suggestion.triggerSource 作为被替换的原始 ID，
        // 将 suggestion.linkedContent 作为新的目标 ID
        if (currentItem.triggerSource && currentItem.linkedContent) {
          currentItem.triggerSource.forEach((source, index) => {
            const linkTarget = currentItem.linkedContent![index];
            if (linkTarget) {
              addApprovedReplacement(source, linkTarget);
              removeReadyEntity(source);

              // 新增：自动将其他依赖该源的未处理建议标记为“已失效”
              suggestions.forEach((s) => {
                if (
                  s.id !== currentItem.id &&
                  s.status === "未处理" &&
                  s.triggerSource &&
                  s.triggerSource.includes(source)
                ) {
                  updateSuggestion(
                    s.id,
                    "已失效",
                    "相关的触发内容已发生变更，该建议项自动失效",
                  );
                }
              });
            }
          });
        }

        // 延迟执行状态清除，给 FramePage 的 useEffect 一定时间去把 isFrameCompleted 设为 false，
        // 这样可以避免错误地立刻触发 startAnimationPhase，进而导致流程过早推进。
        setTimeout(() => {
          // 过渡期结束，解除该建议的过渡拦截状态
          setProcessingSuggestionIds((prev) =>
            prev.filter((id) => id !== currentItem.id),
          );
        }, 100);
      }, 2000);
    }

    setUserComment("");
    setSelectedSuggestionId(null);
    message.success(`已将该建议标记为：${targetStatus}`);
  };

  const handleSubmitNewSuggestion = () => {
    const trimmedComment = userComment.trim();
    if (!trimmedComment) {
      message.warning("请输入建议内容");
      return;
    }

    // 仅当进度条处于关键帧审查(4)和动画审查(6)的工作阶段时开放功能
    if (currentStep !== 4 && currentStep !== 6) {
      message.warning("仅在关键帧审查和动画审查阶段支持提出新建议");
      return;
    }

    const currentModule = currentStep === 6 ? "Animation" : "Frame";
    const currentStage = currentStep === 6 ? "Animation" : "Frame";

    addSuggestion({
      stage: currentStage,
      relatedModule: currentModule,
      originalSuggestion: `[用户建议] ${trimmedComment}`,
    });

    message.success("已提交新建议");
    setUserComment("");
    setSelectedSuggestionId(null);
  };

  const sortedSuggestions = useMemo(() => {
    const statusWeight: Record<string, number> = {
      未处理: 1,
      已确认: 2,
      已拒绝: 3,
      已失效: 4,
    };
    return [...suggestions].sort(
      (a, b) => (statusWeight[a.status] || 5) - (statusWeight[b.status] || 5),
    );
  }, [suggestions]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#fff",
      }}
    >
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #f0f0f0",
          flexShrink: 0,
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          审核与反馈 (Review)
        </Title>
      </div>

      <div
        style={{
          flex: 1,
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "12px",
                flexShrink: 0,
              }}
            >
              <RobotOutlined
                style={{
                  color: "#1677ff",
                  marginRight: "8px",
                  fontSize: "16px",
                }}
              />
              <Text strong style={{ margin: 0, lineHeight: 1 }}>
                系统分析与建议
              </Text>
            </div>
            <Button size="small" type="dashed" onClick={handleTestAdd}>
              + 模拟生成建议
            </Button>
          </div>
          <div
            className="scroll-container"
            style={{
              flex: 1,
              overflowY: "auto",
              background: "#f0f2f5",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #e6e6e6",
            }}
          >
            {initialLoading ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <Spin tip="加载建议中..." />
              </div>
            ) : sortedSuggestions.length > 0 ? (
              sortedSuggestions.map((suggestion) => (
                <ReviewSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  isSelected={suggestion.id === selectedSuggestionId}
                  onClick={handleSuggestionClick}
                />
              ))
            ) : (
              <div
                style={{ textAlign: "center", color: "#999", marginTop: 20 }}
              >
                暂无建议数据
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "16px",
          borderTop: "1px solid #f0f0f0",
          background: "#fafafa",
          flexShrink: 0,
        }}
      >
        <div style={{ marginBottom: "12px" }}>
          <Text strong style={{ display: "block", marginBottom: "8px" }}>
            人工审核批注
          </Text>
          <TextArea
            rows={3}
            placeholder="请在此输入具体的修改意见或打回原因..."
            value={userComment}
            onChange={(e) => setUserComment(e.target.value)}
            style={{ resize: "none" }}
          />
        </div>
        <div style={{ textAlign: "right" }}>
          <Space>
            {(currentStep === 4 || currentStep === 6) && (
              <Button
                onClick={handleSubmitNewSuggestion}
                disabled={!userComment.trim()}
              >
                提出新建议
              </Button>
            )}
            <Button
              icon={<CloseCircleOutlined />}
              danger
              onClick={() => handleAction("已拒绝")}
              disabled={!selectedSuggestionId}
            >
              打回修改
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleAction("已确认")}
              disabled={!selectedSuggestionId}
            >
              确认并推进
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default ReviewPanel;

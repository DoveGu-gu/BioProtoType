import React, { useState, useRef, useEffect } from "react";
import {
  Button,
  Slider,
  Typography,
  message,
  Tooltip,
  Spin,
  Empty,
} from "antd";
import {
  PlayCircleFilled,
  PauseCircleFilled,
  DownloadOutlined,
  ReloadOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import {
  fetchAnimationData,
  fetchAllAnimationData,
  type AnimationData,
} from "./data/animationData";
import { useAppStore } from "../../store/useAppStore";

const { Text } = Typography;

import { workflowController } from "../../controllers/workflowController";
import taskFlowConfig from "../../config/taskFlowConfig.json";

const AnimationPage: React.FC = () => {
  const {
    activeWorkTabKey,
    isAnimationTriggered,
    addReadyEntity,
    approvedReplacements,
    isWorkflowCompleted,
    activeRenderedFrameIds,
  } = useAppStore(); // 引入全局状态获取当前选中的 Tab
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [isReadyToDownload, setIsReadyToDownload] = useState(false);

  const [animationSourceList, setAnimationSourceList] = useState<
    AnimationData[]
  >([]);
  const [animationData, setAnimationData] = useState<AnimationData | null>(
    null,
  );

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [duration, setDuration] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 第一次伪加载：页面级加载
  useEffect(() => {
    if (isAnimationTriggered && !animationData) {
      setLoading(true);
      // TODO:  Animation页面的伪随机时长,15-20s
      // Animation页面加载伪随机时长 15-20s
      const randomDelay =
        Math.floor(Math.random() * (20000 - 15000 + 1)) + 15000;

      const timer = setTimeout(() => {
        const activeTask = taskFlowConfig.tasks.find(
          (t) => t.taskId === taskFlowConfig.currentTaskId,
        );

        const rawAnim = activeTask?.allResourcesList.animations;
        const animIds = rawAnim
          ? Array.isArray(rawAnim)
            ? rawAnim
            : [rawAnim]
          : [];

        // 获取全部动画用来找到匹配的动画
        Promise.all([fetchAllAnimationData(), fetchAnimationData(animIds)])
          .then(([allData, dataArray]) => {
            let filteredAnimations = dataArray;

            // 使用 triggerFrames 进行匹配：需要与 activeRenderedFrameIds 完全匹配
            if (activeRenderedFrameIds && activeRenderedFrameIds.length > 0) {
              const baseRenderedFrameIds = activeRenderedFrameIds;

              filteredAnimations = dataArray.filter((anim) => {
                if (!anim.triggerFrames || anim.triggerFrames.length === 0) {
                  return false;
                }
                // 修改：不需要完全等长，只要当前渲染帧中包含了动画所需的所有触发帧即可
                return anim.triggerFrames.every((fId) =>
                  baseRenderedFrameIds.includes(fId),
                );
              });
            }

            // 随机选取一个
            let selectedAnim = null;
            if (filteredAnimations.length > 0) {
              const randomIndex = Math.floor(
                Math.random() * filteredAnimations.length,
              );
              selectedAnim = filteredAnimations[randomIndex];
            }

            setAnimationSourceList(allData.animations);
            if (selectedAnim) {
              setAnimationData(selectedAnim);
            } else if (
              filteredAnimations.length === 0 &&
              dataArray.length > 0
            ) {
              // fallback 如果全都没匹配上，暂时选第一个或者置空都行
              // selectedAnim = dataArray[0];
            }

            // 这里强制不ready，进入第二次动画伪加载
            setIsReadyToDownload(false);
            setGenerating(true);
          })
          .catch((err) => console.error("加载视频配置失败", err))
          .finally(() => setLoading(false));
      }, randomDelay);

      return () => clearTimeout(timer);
    }
  }, [isAnimationTriggered, animationData]);

  // 第二次伪加载：动画生成加载
  useEffect(() => {
    if (generating && animationData) {
      // TODO：动画的伪随机时长,90-180s
      // 动画生成伪随机时长 1.5-3 分钟 (90000 - 180000 ms) 但为了演示，当是从替换建议触发的生成，可使用短一点时间
      const randomGenDelay =
        Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;

      const timer = setTimeout(() => {
        setGenerating(false);
        setIsReadyToDownload(true);
        workflowController.completeAnimationPhase(true);
        addReadyEntity(animationData.id);
      }, randomGenDelay);

      return () => clearTimeout(timer);
    }
  }, [generating, animationData]);

  // 监听已通过的替换建议及 Frame 更新联动：如果帧数据发生了改变，需重新匹配相应的动画
  useEffect(() => {
    if (!animationData || animationSourceList.length === 0) return;

    // 1. 如果有针对当前动画直接的替换建议，优先处理 (例如速度调整，属于直接替换 Animation 的情况)
    const replaceId = approvedReplacements[animationData.id];
    if (replaceId) {
      const targetAnim = animationSourceList.find((a) => a.id === replaceId);
      if (targetAnim && targetAnim.id !== animationData.id) {
        setAnimationData(targetAnim);
        workflowController.completeAnimationPhase(false);
        workflowController.completeWorkflow(false); // Reset overall completion
        setIsReadyToDownload(false);
        setGenerating(true);
        setProgress(0);
        setIsPlaying(false);
        return; // 已经发生直接替换，停止后续逻辑
      }
    }

    // 2. 如果 Frame 页面的渲染帧列表变化了，我们需要检查当前动画的 triggerFrames 是否还匹配
    if (activeRenderedFrameIds && activeRenderedFrameIds.length > 0) {
      // 判断当前由于帧更新，原来的动画是否依然被新的渲染集完全包含
      const isCurrentMatch =
        animationData.triggerFrames &&
        animationData.triggerFrames.every((fId) =>
          activeRenderedFrameIds.includes(fId),
        );

      if (!isCurrentMatch) {
        // 当前动画不匹配，去全局寻找被新渲染帧包含的新动画
        const matchedAnimations = animationSourceList.filter((anim) => {
          if (!anim.triggerFrames || anim.triggerFrames.length === 0)
            return false;
          // 使用包含判断，不需要等长
          return anim.triggerFrames.every((fId) =>
            activeRenderedFrameIds.includes(fId),
          );
        });

        if (matchedAnimations.length > 0) {
          // 随机选出一个符合条件的动画替换上去
          const randomIndex = Math.floor(
            Math.random() * matchedAnimations.length,
          );
          const nextAnim = matchedAnimations[randomIndex];

          if (nextAnim.id !== animationData.id) {
            setAnimationData(nextAnim);
            workflowController.completeAnimationPhase(false);
            workflowController.completeWorkflow(false); // 重置完成状态以开启重新生成过程
            setIsReadyToDownload(false);
            setGenerating(true);
            setProgress(0);
            setIsPlaying(false);
          }
        }
      }
    }
  }, [
    approvedReplacements,
    animationData,
    animationSourceList,
    activeRenderedFrameIds,
  ]);

  // 移除或保留原有的 useEffect...
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.1 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // 监听 Tab 切换：当不再是 animation 页面时，自动暂停
  useEffect(() => {
    if (activeWorkTabKey !== "animation" && videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [activeWorkTabKey, isPlaying]);

  // 使用真实 Video API 进行播放控制
  const togglePlay = () => {
    if (generating || !isReadyToDownload) {
      if (generating) message.warning("视频生成中，暂时无法播放...");
      return;
    }
    if (!videoRef.current) return;

    if (!videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      // 检查是否播放完毕，如果是则重头播放
      if (
        progress >= 100 ||
        videoRef.current.currentTime >= videoRef.current.duration
      ) {
        videoRef.current.currentTime = 0;
      }
      videoRef.current.play().catch((e) => console.error("播放失败", e));
      setIsPlaying(true);
    }
  };

  // 监听空格键进行播放/暂停控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault(); // 阻止页面滚动
        togglePlay();
      }
    };

    // 绑定到 document 上
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [progress]); // 依赖 progress 是因为 togglePlay 内部用到了它。或者可以直接在 togglePlay 用 videoRef 判断。

  // 提供高频（每 0.1s）的进度更新
  useEffect(() => {
    let interval: number | undefined;
    if (isPlaying) {
      interval = window.setInterval(() => {
        if (videoRef.current && videoRef.current.duration > 0) {
          const current = videoRef.current.currentTime;
          const total = videoRef.current.duration;
          setProgress((current / total) * 100);
        }
      }, 100);
    }
    return () => {
      if (interval !== undefined) clearInterval(interval);
    };
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      // 当视频暂停时（或原生事件触发时）也稍微更新一下，主要依靠上面的 setInterval 平滑更新
      if (total > 0 && !isPlaying) {
        setProgress((current / total) * 100);
      }

      // 处理结束状态
      if (current >= total && total > 0) {
        setIsPlaying(false);
        setProgress(100);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (value: number) => {
    if (generating || !isReadyToDownload) return;
    if (videoRef.current && duration > 0) {
      const newTime = (value / 100) * duration;
      videoRef.current.currentTime = newTime;
      setProgress(value);
    }
  };

  const handleDownload = () => {
    if (!isWorkflowCompleted) {
      message.warning(
        "部分审查建议项尚未完成处理，当前阶段禁止下载。请先处理右侧的审查环节，确认无误后再进行下载。",
      );
      return;
    }
    if (!isReadyToDownload || generating || !animationData?.videoUrl) {
      message.warning("正在生成高质量动画视频，可能需要1-3分钟，请稍候...");
      return;
    }

    // 创建一个隐藏的 a 标签来触发下载
    const link = document.createElement("a");
    link.href = animationData.videoUrl;
    link.download = animationData.title
      ? `${animationData.title}.mp4`
      : "animation.mp4"; // 指定下载文件名
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 弹出工作流结束提示
    message.success({
      content: "系统工作流全部结束！正在开始下载最终流程演示视频 (1080p)...",
      duration: 5,
    });
  };

  if (!isAnimationTriggered && !animationData) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <Empty description="动画尚未生成，等待事件脚本及关键帧生成" />
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
        <Spin tip="Animation 页面环境加载中 (约15~20s)..." size="large" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* 灰色背景容器：对应 Knowledge 页面的风格 */}
      <div
        style={{
          flex: 1,
          background: "#f5f5f5", // 浅灰背景
          borderRadius: "8px",
          border: "1px solid #e6e6e6",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          minHeight: 0,
        }}
      >
        {/* 右上角下载按钮 */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            zIndex: 10,
          }}
        >
          <Tooltip
            title={
              !isWorkflowCompleted
                ? "需完成所有阶段审查才能下载"
                : isReadyToDownload
                  ? "下载最终视频"
                  : "视频生成中"
            }
          >
            <Button
              type="text"
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              disabled={!isWorkflowCompleted || !isReadyToDownload}
              style={{
                color:
                  !isWorkflowCompleted || !isReadyToDownload ? "#ccc" : "#666",
                fontWeight: "bold",
                background: "rgba(0,0,0,0.05)",
              }}
            >
              下载
            </Button>
          </Tooltip>
        </div>

        {/* 视频播放器主体 (白色区域) - 放大 50% */}
        <div
          style={{
            width: "95%",
            maxWidth: "1050px", // 700px * 1.5 = 1050px
            aspectRatio: "16/9",
            background: "#eff2f5", // 屏幕底色
            borderRadius: "6px",
            border: "1px solid #d9d9d9", // 灰色边框
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {/* 屏幕内容区 */}
          <div
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: generating ? "not-allowed" : "pointer",
              background: "#e6f4ff", // 模拟视频画面背景
              minHeight: 0, // <--- 防止被内部 video 的原始尺寸撑开，导致底部控制条被挤出
              paddingTop: "40px", // <--- 为视频上部提供视觉空间余量
              paddingBottom: "40px", // <--- 为视频下部提供视觉空间余量
            }}
            onClick={togglePlay}
          >
            {/* 生成中的遮罩层 (1.5-3分钟长时加载) */}
            {generating && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(255, 255, 255, 0.8)",
                  zIndex: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none", // click 可以穿透，但实际上上层的点击已被禁用
                }}
              >
                <Spin
                  indicator={<LoadingOutlined style={{ fontSize: 64 }} spin />}
                />
                <Text
                  strong
                  style={{ marginTop: 24, fontSize: 18, color: "#1677ff" }}
                >
                  正在生成动画预览...
                </Text>
                <Text style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
                  此过程通常需耗时约 1.5 - 3 分钟，请耐心等待
                </Text>
              </div>
            )}

            {/* 真实视频或模拟视频内容 */}
            {animationData?.videoUrl && isReadyToDownload ? (
              <video
                ref={videoRef}
                src={animationData.videoUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain", // <--- 改为 contain，避免视频画面本身被裁切
                  display: "block",
                }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => {
                  setIsPlaying(false);
                  setProgress(100);
                }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0.3,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    fontSize: "60px", // 40px -> 60px
                    fontWeight: "bold",
                    color: "#1677ff",
                  }}
                >
                  BIO-WORKFLOW
                </div>
                <div style={{ fontSize: "24px", color: "#333", marginTop: 15 }}>
                  High-Fidelity Render Preview
                </div>
              </div>
            )}

            {/* 居中播放按钮 (暂停或结束时显示) */}
            {isReadyToDownload && (!isPlaying || progress >= 100) && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 5,
                  background: "rgba(255,255,255,0.8)",
                  borderRadius: "50%",
                  padding: "6px", // 4px -> 6px
                  boxShadow: "0 6px 15px rgba(0,0,0,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none", // 让点击穿透到下面的触发区
                }}
              >
                {progress >= 100 ? (
                  <ReloadOutlined
                    style={{
                      fontSize: "96px", // 64px -> 96px
                      color: "#333",
                      display: "block",
                    }}
                  />
                ) : (
                  <PlayCircleFilled
                    style={{
                      fontSize: "108px", // 72px -> 108px
                      color: "#1677ff", // 蓝色播放按钮
                      display: "block",
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* 底部控制条 */}
          <div
            style={{
              height: "40px",
              flexShrink: 0, // <--- 防止被压缩
              background: "#fff",
              borderTop: "1px solid #ddd",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              gap: "12px",
            }}
          >
            <div
              onClick={togglePlay}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                color: "#333",
              }}
            >
              {isPlaying ? (
                <PauseCircleFilled style={{ fontSize: "20px" }} />
              ) : (
                <PlayCircleFilled style={{ fontSize: "20px" }} />
              )}
            </div>

            <div style={{ flex: 1, margin: "0 10px" }}>
              <Slider
                disabled={generating || !isReadyToDownload}
                value={progress}
                onChange={handleSeek}
                max={100}
                step={0.1} // 使得拖动和进度更新更平滑
                tooltip={{
                  formatter: (val) => {
                    if (typeof val === "number" && duration > 0) {
                      const currentTime = (val / 100) * duration;
                      return `${currentTime.toFixed(1)}s`;
                    }
                    return `${val?.toFixed(1)}%`;
                  },
                }}
                styles={{
                  track: { backgroundColor: "#1677ff" },
                  handle: { borderColor: "#1677ff" },
                }}
              />
            </div>

            <Text
              style={{
                fontSize: "12px",
                color: "#666",
                width: "70px",
                textAlign: "right",
              }}
            >
              {((duration * progress) / 100).toFixed(1)}s /{" "}
              {duration.toFixed(1)}s
            </Text>
          </div>
        </div>

        {/* 底部状态文字 */}
        <div
          style={{
            marginTop: "16px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#333", fontSize: "16px", fontWeight: "bold" }}>
            {animationData?.title
              ? `当前预览：${animationData.title}`
              : "暂无预览数据"}
          </Text>
          {animationData?.description && (
            <Text style={{ color: "#666", fontSize: "14px", marginTop: "8px" }}>
              {animationData.description}
            </Text>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnimationPage;

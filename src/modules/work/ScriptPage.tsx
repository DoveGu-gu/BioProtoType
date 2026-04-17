import React, { useEffect, useState } from "react";
import { Typography, Tag, Spin, Empty } from "antd";
import {
  FileImageOutlined,
  CodeSandboxOutlined, // For 3D
  ExperimentOutlined, // For Effect
  LayoutOutlined, // For UI
  SoundOutlined, // For Audio
  CheckCircleFilled, // For Ready
  ClockCircleFilled, // For Pending
  SyncOutlined, // For Generating
} from "@ant-design/icons";
import { fetchScriptData, type ScriptItem } from "./data/scriptData";
import { useAppStore } from "../../store/useAppStore";

const { Text } = Typography;

type ResourceStatus = "待生成" | "生成中" | "已就绪";

import { workflowController } from "../../controllers/workflowController";
import taskFlowConfig from "../../config/taskFlowConfig.json";

const ScriptPage: React.FC = () => {
  const { isScriptTriggered } = useAppStore();
  const [scriptData, setScriptData] = useState<ScriptItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [resourceStatuses, setResourceStatuses] = useState<
    Record<string, ResourceStatus>
  >({});

  useEffect(() => {
    if (isScriptTriggered && !scriptData) {
      setLoading(true);

      // 第一次伪加载为加载整个Script页面，持续15-20s
      // TODO: Script页面的伪随机时长,15-20s
      const randomDelay = Math.floor(Math.random() * (20000 - 15000 + 1)) + 0;

      const timer = setTimeout(() => {
        const activeTask = taskFlowConfig.tasks.find(
          (t) => t.taskId === taskFlowConfig.currentTaskId,
        );
        let scriptId = activeTask?.allResourcesList.scripts || "";

        const state = useAppStore.getState();
        const activeLinkedResourceIds = state.activeLinkedResourceIds;
        /*
        // 注释分支机制逻辑
        if (activeTask && activeBranchId) {
          const branch = activeTask.branchs?.find(
            (b) => b.id === activeBranchId,
          );
          if (branch) {
            scriptId = branch.resourcesList.scripts;
            validStoryboards = (branch.resourcesList as any).storyboards;
            validResources = (branch.resourcesList as any).resources;
          }
        }
        */

        fetchScriptData(scriptId)
          .then((data) => {
            if (data) {
              let filteredData = { ...data };

              // 按照基于连接机制拿到的资源ID过滤 resources与storyboards
              const activeCheckedComponentIds = state.activeCheckedComponentIds;

              if (activeLinkedResourceIds.length > 0) {
                filteredData.resources = filteredData.resources.filter((r) =>
                  activeLinkedResourceIds.includes(r.id),
                );
              }

              // 利用 triggerComponents 过滤 storyboards (要求被勾选的 Component 和 triggerComponents 完全匹配)
              filteredData.storyboards = filteredData.storyboards.filter(
                (s) => {
                  if (!s.triggerComponents || s.triggerComponents.length === 0)
                    return true;

                  // 完全匹配：长度一致，且每一个都在激活列表中
                  if (
                    s.triggerComponents.length !==
                    activeCheckedComponentIds.length
                  ) {
                    return false;
                  }
                  return s.triggerComponents.every((compId) =>
                    activeCheckedComponentIds.includes(compId),
                  );
                },
              );

              /* // 分支逻辑过滤已弃用
              if (validStoryboards && Array.isArray(validStoryboards)) {
                filteredData.storyboards = filteredData.storyboards.filter(
                  (s) => validStoryboards!.includes(s.id),
                );
              }
              if (validResources && Array.isArray(validResources)) {
                filteredData.resources = filteredData.resources.filter((r) =>
                  validResources!.includes(r.id),
                );
              }
              */

              setScriptData(filteredData);

              // 提取 filteredData.storyboards 中的 linkedFrameIds 传递给下阶段
              const frameIds = new Set<string>();
              filteredData.storyboards.forEach((s) => {
                if (s.linkedFrameIds && Array.isArray(s.linkedFrameIds)) {
                  s.linkedFrameIds.forEach((id) => frameIds.add(id.trim()));
                } else if (typeof s.linkedFrameIds === "string") {
                  // @ts-ignore: 兼容旧数据格式
                  (s.linkedFrameIds as string)
                    .split(",")
                    .forEach((id: string) => frameIds.add(id.trim()));
                }
              });
              useAppStore
                .getState()
                .setActiveLinkedFrameIds(Array.from(frameIds));

              const initialStatuses: Record<string, ResourceStatus> = {};
              filteredData.resources.forEach((r) => {
                initialStatuses[r.id] =
                  (r.status as ResourceStatus) || "待生成";
              });
              setResourceStatuses(initialStatuses);
            }
          })
          .catch((err) => console.error("加载脚本数据失败：", err))
          .finally(() => setLoading(false));
      }, randomDelay);

      return () => clearTimeout(timer);
    }
  }, [isScriptTriggered, scriptData]);

  // 第二次伪加载：对资源清单的伪加载，逐条进行
  useEffect(() => {
    if (!scriptData || loading) return;

    // 检查当前是否有正在“生成中”的资源
    const currentGenerating = scriptData.resources.find(
      (r) => resourceStatuses[r.id] === "生成中",
    );

    if (currentGenerating) {
      // 如果已有生成中的资源，为其分配20-40s的定时器
      // TODO: 每张图的伪随机时长,20-40s
      const randomGenDelay =
        Math.floor(Math.random() * (20000 - 20000 + 1)) + 0;

      const timer = setTimeout(() => {
        // 完成后设为“已就绪”
        setResourceStatuses((prev) => ({
          ...prev,
          [currentGenerating.id]: "已就绪",
        }));
      }, randomGenDelay);

      // 如果资源状态变动或组件卸载，清理当前的定时器
      return () => clearTimeout(timer);
    } else {
      // 如果当前没有“生成中”的项，则寻找下一个“待生成”的资源
      const nextPending = scriptData.resources.find(
        (r) => resourceStatuses[r.id] === "待生成",
      );

      if (nextPending) {
        // 把下一个资源标记为“生成中”
        setResourceStatuses((prev) => ({
          ...prev,
          [nextPending.id]: "生成中",
        }));
      } else {
        // 如果当前没有“生成中”也没有“待生成”，说明全部“已就绪”
        const allReady = scriptData.resources.every(
          (r) => resourceStatuses[r.id] === "已就绪",
        );
        if (allReady) {
          workflowController.startFramePhase();
        }
      }
    }
  }, [scriptData, loading, resourceStatuses]);

  if (!isScriptTriggered && !scriptData) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <Empty description="暂无事件脚本数据，等待知识点完成确认" />
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
        <Spin size="large" tip="Script 页面环境加载中 (约15~20s).." />
      </div>
    );
  }

  if (!scriptData) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <Empty description="暂无数据" />
      </div>
    );
  }

  return (
    // 外层容器：占满整个面板高度，纯白背景，现代极简风格
    <div
      style={{
        height: "100%",
        display: "flex",
        gap: "16px",
        overflow: "hidden",
      }}
    >
      {/* --- 左侧栏：事件分镜列表 (浅灰色调) --- */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
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
          事件分镜列表
        </Text>

        {/* 滑动容器：采用极浅的灰色背景 (#f5f5f5) */}
        <div
          className="scroll-container"
          style={{
            flex: 1,
            background: "#f5f5f5",
            borderRadius: "6px",
            border: "1px solid #e6e6e6", // 搭配浅灰色的边框
            padding: "12px",
            overflowY: "auto", // 开启局部滚动
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            minHeight: 0,
          }}
        >
          {scriptData.storyboards.map((scene, index) => (
            // 只读卡片展示
            <div
              key={scene.id}
              style={{
                background: "#fff",
                borderRadius: "8px",
                padding: "16px",
                border: "1px solid #e6e6e6",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {/* 顶部：编号标题 + 持续时间 */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #f0f0f0",
                  paddingBottom: "8px",
                }}
              >
                <Text strong style={{ color: "#1f1f1f", fontSize: "15px" }}>
                  {`No.${String(index + 1).padStart(2, "0")} : ${scene.title}`}
                </Text>
                <Tag color="default" style={{ margin: 0 }}>
                  {scene.duration}
                </Tag>
              </div>

              {/* 中部：运镜 + 画面描述 */}
              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: "0 0 70px" }}>
                  <Text
                    type="secondary"
                    style={{ fontSize: "12px", display: "block" }}
                  >
                    运镜方式
                  </Text>
                  <Text strong style={{ color: "#333", fontSize: "14px" }}>
                    {scene.camera}
                  </Text>
                </div>
                <div
                  style={{
                    flex: 1,
                    borderLeft: "2px solid #f0f0f0",
                    paddingLeft: "16px",
                  }}
                >
                  <Text
                    type="secondary"
                    style={{
                      fontSize: "12px",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    画面内容
                  </Text>
                  <Text
                    style={{
                      fontSize: "13px",
                      color: "#333",
                      lineHeight: "1.6",
                    }}
                  >
                    {scene.content}
                  </Text>
                </div>
              </div>

              {/* 底部：涉及资源 */}
              {scene.relatedResources && scene.relatedResources.length > 0 && (
                <div
                  style={{
                    background: "#fafafa",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    marginTop: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      涉及资源:
                    </Text>
                    {scene.relatedResources.map((rid) => {
                      const res = scriptData.resources.find(
                        (r) => r.id === rid,
                      );
                      return res ? (
                        <Tag
                          key={rid}
                          color="blue"
                          bordered={false}
                          style={{ margin: 0 }}
                        >
                          {res.name}
                        </Tag>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* --- 右侧栏：资源清单 (浅灰色调) --- */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
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
          资源清单
        </Text>

        {/* 滑动容器：采用极浅的灰色背景 (#f5f5f5) */}
        <div
          style={{
            flex: 1,
            background: "#f5f5f5",
            borderRadius: "6px",
            border: "1px solid #e6e6e6", // 搭配浅灰色的边框
            padding: "12px",
            overflowY: "auto", // 开启局部滚动
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            minHeight: 0,
          }}
        >
          {scriptData.resources.map((resource) => {
            // 根据类型获取图标
            const getIcon = (type: string) => {
              switch (type) {
                case "3D 模型":
                  return <CodeSandboxOutlined style={{ fontSize: "16px" }} />;
                case "特效":
                  return <ExperimentOutlined style={{ fontSize: "16px" }} />;
                case "UI 贴图":
                  return <LayoutOutlined style={{ fontSize: "16px" }} />;
                case "音频":
                  return <SoundOutlined style={{ fontSize: "16px" }} />;
                default:
                  // 默认：图像
                  return <FileImageOutlined style={{ fontSize: "16px" }} />;
              }
            };

            return (
              // 只读资源条目展示
              <div
                key={resource.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#fff",
                  borderRadius: "6px",
                  padding: "12px",
                  border: "1px solid #e6e6e6",
                  flexShrink: 0,
                }}
              >
                {/* 左侧：资源类型(Icon) + 素材名称 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {/* 类型图标容器 */}
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "6px",
                      background: "#f0f0f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#666",
                      flexShrink: 0,
                    }}
                  >
                    {getIcon(resource.type)}
                  </div>

                  {/* 名称与类型描述 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: "12px",
                        color: "#999",
                        flexShrink: 0,
                        background: "#f5f5f5",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {resource.type || "图像"}
                    </Text>
                    <Text
                      style={{
                        fontSize: "14px",
                        color: "#1f1f1f",
                        fontWeight: 500,
                      }}
                      ellipsis
                    >
                      {resource.name}
                    </Text>
                  </div>
                </div>

                {/* 右侧：素材状态 */}
                <div
                  style={{
                    marginLeft: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flexShrink: 0,
                  }}
                >
                  {(() => {
                    const status = resourceStatuses[resource.id] || "待生成";
                    if (status === "已就绪") {
                      return (
                        <>
                          <CheckCircleFilled
                            style={{ color: "#52c41a", fontSize: "14px" }}
                          />
                          <Text style={{ fontSize: "12px", color: "#52c41a" }}>
                            已就绪
                          </Text>
                        </>
                      );
                    } else if (status === "生成中") {
                      return (
                        <>
                          <SyncOutlined
                            spin
                            style={{ color: "#1677ff", fontSize: "14px" }}
                          />
                          <Text style={{ fontSize: "12px", color: "#1677ff" }}>
                            生成中
                          </Text>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <ClockCircleFilled
                            style={{ color: "#faad14", fontSize: "14px" }}
                          />
                          <Text style={{ fontSize: "12px", color: "#faad14" }}>
                            待生成
                          </Text>
                        </>
                      );
                    }
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ScriptPage;

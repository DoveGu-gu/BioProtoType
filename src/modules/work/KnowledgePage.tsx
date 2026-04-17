import React, { useEffect, useState } from "react";
import { Typography, Spin, Empty, Button } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { useAppStore } from "../../store/useAppStore";
import {
  fetchKnowledgeData,
  type KnowledgeData,
  type ComponentData,
} from "./data/knowledgeData";

const { Text } = Typography;

import { workflowController } from "../../controllers/workflowController";
import taskFlowConfig from "../../config/taskFlowConfig.json";

const KnowledgePage: React.FC = () => {
  const { isKnowledgeTriggered, isScriptTriggered } = useAppStore();
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeData | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  useEffect(() => {
    if (isKnowledgeTriggered) {
      setLoading(true);

      // 启动伪加载，随机时长（15~20秒）
      // TODO: Knowledge的伪随机时长,15-20s
      const randomDelay = Math.floor(Math.random() * (20000 - 15000 + 1)) + 0;

      const timer = setTimeout(() => {
        const activeTask = taskFlowConfig.tasks.find(
          (t) => t.taskId === taskFlowConfig.currentTaskId,
        );
        const knowledgeId = activeTask?.allResourcesList.knowledge || "";

        fetchKnowledgeData(knowledgeId)
          .then((data) => {
            if (data) {
              setKnowledgeData(data);
              if (data.components && data.components.length > 0) {
                setActiveId(data.components[0].id);

                // 筛选出dafult为true的项的id，并初始化到已选集合中
                const initialCheckedIds = data.components
                  .filter((c) => c.dafult === true)
                  .map((c) => c.id);
                setCheckedIds(initialCheckedIds);
              }
            }
          })
          .finally(() => setLoading(false));
      }, randomDelay);

      return () => clearTimeout(timer);
    }
  }, [isKnowledgeTriggered]);
  const currentPoint = knowledgeData?.components.find((p) => p.id === activeId);

  const handleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (isScriptTriggered) return;

    // 找到当前点击的内容
    const currentComp = knowledgeData?.components.find((c) => c.id === id);

    // 拦截：如果是默认勾选项，禁止修改
    if (currentComp?.dafult) {
      return;
    }

    const relatedIds = currentComp?.relatedIds || [];

    // 要同时改变状态的完整 ID 集合
    const idsToToggle = [id, ...relatedIds];

    setCheckedIds((prev) => {
      // 检查当前 id 是否已被勾选
      const isChecked = prev.includes(id);

      if (isChecked) {
        // 如果已勾选，则取消勾选该 id 及其所有的关联 id
        return prev.filter((item) => !idsToToggle.includes(item));
      } else {
        // 如果未勾选，则添加该 id 及其关联 id（并去重）
        return Array.from(new Set([...prev, ...idsToToggle]));
      }
    });
  };

  if (!isKnowledgeTriggered && !knowledgeData) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <Empty description="暂无知识点数据，请进行对话中触发可视化工作流" />
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
        <Spin size="large" tip="Knowledge 页面环境加载中 (约15~20s).." />
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          background: "#fafafa",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "16px",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          border: "1px solid #f0f0f0",
          gap: "16px",
        }}
      >
        <div
          style={{
            flex: "0 0 60%",
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
            细胞生物知识解释
          </Text>

          <div
            style={{
              flex: 1,
              background: "#fff",
              borderRadius: "6px",
              border: "1px solid #e6e6e6",
              padding: "16px",
              overflowY: "auto",
            }}
          >
            <Text
              style={{ fontSize: "14px", lineHeight: "1.8", color: "#333" }}
            >
              {currentPoint?.explanation ||
                "(请在右侧选择一个细胞结构或生物大分子以查看解释)"}
            </Text>
          </div>
        </div>

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
            细胞结构或生物大分子
          </Text>

          <div
            className="scroll-container"
            style={{
              flex: 1,
              background: "#f5f5f5",
              borderRadius: "6px",
              border: "1px solid #e6e6e6",
              padding: "12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              minHeight: 0,
            }}
          >
            {knowledgeData?.components?.map((point: ComponentData) => {
              const isActive = point.id === activeId;
              const isChecked = checkedIds.includes(point.id);

              return (
                <div
                  key={point.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    background: "#fff",
                    borderRadius: "8px",
                    border: "1px solid #e6e6e6",
                    padding: "10px 14px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    transition: "all 0.2s ease-in-out",
                    ...(isActive && {
                      background: "#e6f4ff",
                      border: "1px solid #1677ff",
                    }),
                  }}
                >
                  <div
                    onClick={(e) => handleCheck(point.id, e)}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: "12px",
                      cursor:
                        point.dafult || isScriptTriggered
                          ? "not-allowed"
                          : "pointer",
                      flexShrink: 0,
                      background: isChecked
                        ? point.dafult
                          ? "#bae0ff"
                          : "#1677ff" // 针对固定默认项给予不同颜色区分（如淡蓝色）
                        : "#fafafa",
                      border: isChecked
                        ? `1px solid ${point.dafult ? "#91caff" : "#1677ff"}`
                        : "1px solid #d9d9d9",
                      transition: "all 0.2s",
                    }}
                  >
                    {isChecked && (
                      <CheckOutlined
                        style={{
                          fontSize: "14px",
                          color: point.dafult ? "#1677ff" : "#fff",
                          fontWeight: "bold",
                        }}
                      />
                    )}
                  </div>

                  <div
                    onClick={() => setActiveId(point.id)}
                    style={{
                      flex: 1,
                      cursor: "pointer",
                    }}
                  >
                    <Text
                      strong={isActive}
                      style={{
                        fontSize: "14px",
                        color: isActive ? "#1677ff" : "#333",
                      }}
                    >
                      {point.name}
                    </Text>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              paddingTop: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <Text type="secondary" style={{ fontSize: "12px" }}>
              点击细胞结构或生物大分子查看对应解释
              <br />
              *被选中细胞结构或生物大分子将作为可视化的重点
            </Text>
            <Button
              type="primary"
              style={{ width: "100%" }}
              disabled={isScriptTriggered}
              onClick={() => {
                // 注释分支机制逻辑
                /*
                const activeTask = taskFlowConfig.tasks.find(
                  (t) => t.taskId === taskFlowConfig.currentTaskId,
                );

                let matchedBranch = null;
                if (
                  activeTask &&
                  activeTask.branchs &&
                  activeTask.branchs.length > 0
                ) {
                  let maxMatchBranch = null;
                  let maxMatchLen = -1;
                  for (const branch of activeTask.branchs) {
                    const components = branch.knowledge_components || [];
                    const isSubset = components.every((c: string) =>
                      checkedIds.includes(c),
                    );
                    if (isSubset && components.length > maxMatchLen) {
                      maxMatchLen = components.length;
                      maxMatchBranch = branch;
                    }
                  }
                  matchedBranch = maxMatchBranch;
                }

                setActiveBranchId(matchedBranch ? matchedBranch.id : null);
                */

                // 连接机制：提取选中的知识点中 linkedresourceIds 以供下一步使用
                if (knowledgeData && knowledgeData.components) {
                  const linkedResSet = new Set<string>();
                  knowledgeData.components.forEach((comp) => {
                    if (
                      checkedIds.includes(comp.id) &&
                      comp.linkedresourceIds
                    ) {
                      comp.linkedresourceIds.forEach((resId) =>
                        linkedResSet.add(resId),
                      );
                    }
                  });
                  useAppStore
                    .getState()
                    .setActiveLinkedResourceIds(Array.from(linkedResSet));
                  useAppStore
                    .getState()
                    .setActiveCheckedComponentIds(checkedIds);
                }

                workflowController.startScriptPhase();
              }}
            >
              确认
            </Button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <Text
          strong
          style={{
            fontSize: "16px",
            color: "#1f1f1f",
            marginBottom: "12px",
            display: "block",
          }}
        >
          细胞过程阐述
        </Text>

        <div
          style={{
            background: "#fafafa",
            borderRadius: "8px",
            padding: "20px",
            border: "1px solid #f0f0f0",
            minHeight: "225px",
            overflowY: "auto",
          }}
        >
          <Text style={{ fontSize: "14px", lineHeight: "1.8", color: "#333" }}>
            {knowledgeData?.processDescription || "暂无相关细胞过程阐述"}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default KnowledgePage;

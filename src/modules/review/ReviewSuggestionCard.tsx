// src/modules/review/ReviewSuggestionCard.tsx
import React from "react";
import { Card, Typography } from "antd";
import { type Suggestion } from "../../store/useAppStore";

const { Text } = Typography;

interface ReviewSuggestionCardProps {
  suggestion: Suggestion;
  isSelected: boolean;
  onClick: (id: string, text: string) => void;
}

const ReviewSuggestionCard: React.FC<ReviewSuggestionCardProps> = ({
  suggestion,
  isSelected,
  onClick,
}) => {
  const isPending = suggestion.status === "未处理";

  // 顶部小标签的颜色映射 (保持柔和)
  const statusColorMap: Record<string, string> = {
    未处理: "#f0f0f0",
    已确认: "#e6f7ff",
    已拒绝: "#fff1f0",
    已失效: "#f5f5f5",
  };
  const statusTextColorMap: Record<string, string> = {
    未处理: "#8c8c8c",
    已确认: "#1890ff",
    已拒绝: "#ff4d4f",
    已失效: "#8c8c8c",
  };

  // --- 核心修改1：卡片主体内容区域的强烈背景色映射 ---
  const mainBgColorMap: Record<string, string> = {
    未处理: "#d4b106", // 警示金黄
    已确认: "#52c41a", // 成功绿色
    已拒绝: "#ff4d4f", // 拒绝红色
    已失效: "#bfbfbf", // 失效灰色
  };
  const mainBorderColorMap: Record<string, string> = {
    未处理: "#c4a100",
    已确认: "#389e0d",
    已拒绝: "#cf1322",
    已失效: "#8c8c8c",
  };

  return (
    <Card
      size="small"
      style={{
        marginBottom: "10px",
        borderRadius: "8px",
        border: isSelected ? "2px solid #1677ff" : "1px solid #e6e6e6",
        cursor: isPending ? "pointer" : "default",
        transition: "all 0.2s ease",
        background: isSelected ? "#e6f4ff" : "#fff",
        boxShadow: isSelected
          ? "0 0 5px rgba(22, 119, 255, 0.3)"
          : "0 1px 2px rgba(0,0,0,0.05)",
        flexShrink: 0,
      }}
      bodyStyle={{ padding: "12px" }}
      onClick={() =>
        isPending && onClick(suggestion.id, suggestion.originalSuggestion)
      }
    >
      {/* 1. 卡片顶部区域 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "12px",
          gap: "8px",
        }}
      >
        <div
          style={{
            background: "#d9d9d9",
            color: "#595959",
            padding: "4px 10px",
            borderRadius: "16px",
            fontSize: "12px",
            fontWeight: "500",
            whiteSpace: "nowrap",
          }}
        >
          工作阶段: {suggestion.stage}
        </div>
        <div
          style={{
            background: statusColorMap[suggestion.status],
            color: statusTextColorMap[suggestion.status],
            padding: "4px 10px",
            borderRadius: "16px",
            fontSize: "12px",
            whiteSpace: "nowrap",
          }}
        >
          状态: {suggestion.status}
        </div>
      </div>

      {/* 2. 卡片主体区域：应用新的颜色映射 */}
      <div
        style={{
          background: mainBgColorMap[suggestion.status], // 动态背景色
          color: "#fff",
          padding: "12px",
          borderRadius: "8px",
          wordWrap: "break-word",
          border: `1px solid ${mainBorderColorMap[suggestion.status]}`, // 动态边框色
        }}
      >
        <Text style={{ color: "#fff", fontSize: "14px" }}>
          {suggestion.status === "未处理" || suggestion.status === "已失效"
            ? suggestion.originalSuggestion
            : suggestion.finalSuggestion}
        </Text>
      </div>
    </Card>
  );
};

export default ReviewSuggestionCard;

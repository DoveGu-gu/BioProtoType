// src/store/useAppStore.ts
import { create } from "zustand";

export interface Suggestion {
  id: string;
  stage: string; // 工作阶段
  relatedModule?: string; // 关联的模块，如 "Frame" | "Animation"
  status: "未处理" | "已确认" | "已拒绝"; // 处理状态
  originalSuggestion: string; // 系统的原始建议内容
  finalSuggestion: string; // 经用户审批的最终建议内容
  linkedContent?: string[]; // 确认后关联加载的内容
  triggerSource?: string[]; // ---新增保留的分析源头ID---
  processedResult?: string; // 建议处理的结果
  exclusion?: string[]; // 互斥的建议项ID
}

interface AppState {
  // --- 核心修改 1：新增用户 ID 状态 ---
  userId: string | null;
  setUserId: (id: string | null) => void;

  selectedDialogueId: string | null;
  activeWorkTabKey: string;
  suggestions: Suggestion[];
  isKnowledgeTriggered: boolean;
  setKnowledgeTriggered: (val: boolean) => void;
  showKnowledgeHighlight: boolean;
  setShowKnowledgeHighlight: (val: boolean) => void;
  isScriptTriggered: boolean;
  setScriptTriggered: (val: boolean) => void;
  showScriptHighlight: boolean;
  setShowScriptHighlight: (val: boolean) => void;
  isFrameTriggered: boolean;
  setFrameTriggered: (val: boolean) => void;
  showFrameHighlight: boolean;
  setShowFrameHighlight: (val: boolean) => void;
  isAnimationTriggered: boolean;
  setAnimationTriggered: (val: boolean) => void;
  showAnimationHighlight: boolean;
  setShowAnimationHighlight: (val: boolean) => void;
  isFrameCompleted: boolean;
  setFrameCompleted: (val: boolean) => void;
  isAnimationCompleted: boolean;
  setAnimationCompleted: (val: boolean) => void;
  isWorkflowCompleted: boolean;
  setWorkflowCompleted: (val: boolean) => void;
  readyEntities: string[];
  addReadyEntity: (id: string) => void;
  removeReadyEntity: (id: string) => void;
  replaceReadyEntity: (oldId: string, newId: string) => void;
  approvedReplacements: Record<string, string>;
  addApprovedReplacement: (originalId: string, newId: string) => void;
  addSuggestion: (payload: {
    id?: string;
    stage: string;
    relatedModule?: string;
    originalSuggestion: string;
    linkedContent?: string[];
    triggerSource?: string[];
    processedResult?: string;
    exclusion?: string[];
  }) => void;
  updateSuggestion: (
    id: string,
    status: "已确认" | "已拒绝",
    finalText: string,
  ) => void;
  setSuggestions: (suggestions: Suggestion[]) => void;
  setSelectedDialogueId: (id: string | null) => void;
  setActiveWorkTabKey: (key: string) => void;
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
  // 新增：保存用户勾选的 Component ID
  activeCheckedComponentIds: string[];
  setActiveCheckedComponentIds: (ids: string[]) => void;
  activeLinkedResourceIds: string[];
  setActiveLinkedResourceIds: (ids: string[]) => void;
  activeLinkedFrameIds: string[];
  setActiveLinkedFrameIds: (ids: string[]) => void;
  activeLinkedAnimationIds: string[];
  setActiveLinkedAnimationIds: (ids: string[]) => void;
  activeRenderedFrameIds: string[];
  setActiveRenderedFrameIds: (ids: string[]) => void;
}

// const initialSuggestions: Suggestion[] = [
//   // ... 之前的初始数据保持不变
// ];

// 初始化时，尝试从本地缓存获取之前保存的 userId
const savedUserId = localStorage.getItem("app_user_id");

export const useAppStore = create<AppState>((set) => ({
  // --- 核心修改 2：装载初始 ID ---
  userId: savedUserId || null,

  // 更新 ID 时，同步写入本地缓存
  setUserId: (id) => {
    if (id) {
      localStorage.setItem("app_user_id", id);
    } else {
      localStorage.removeItem("app_user_id"); // 支持登出/清除操作
    }
    set({ userId: id });
  },

  selectedDialogueId: null,
  activeWorkTabKey: "knowledge",
  suggestions: [], // 修改为从空数组开始
  isKnowledgeTriggered: false,
  setKnowledgeTriggered: (val) => set({ isKnowledgeTriggered: val }),
  showKnowledgeHighlight: false,

  setShowKnowledgeHighlight: (val) => set({ showKnowledgeHighlight: val }),
  isScriptTriggered: false,
  setScriptTriggered: (val) => set({ isScriptTriggered: val }),
  showScriptHighlight: false,
  setShowScriptHighlight: (val) => set({ showScriptHighlight: val }),
  isFrameTriggered: false,
  setFrameTriggered: (val) => set({ isFrameTriggered: val }),
  showFrameHighlight: false,
  setShowFrameHighlight: (val) => set({ showFrameHighlight: val }),
  isAnimationTriggered: false,
  setAnimationTriggered: (val) => set({ isAnimationTriggered: val }),
  showAnimationHighlight: false,
  setShowAnimationHighlight: (val) => set({ showAnimationHighlight: val }),
  isFrameCompleted: false,
  setFrameCompleted: (val) => set({ isFrameCompleted: val }),
  isAnimationCompleted: false,
  setAnimationCompleted: (val) => set({ isAnimationCompleted: val }),
  isWorkflowCompleted: false,
  setWorkflowCompleted: (val) => set({ isWorkflowCompleted: val }),
  readyEntities: [],
  addReadyEntity: (id) =>
    set((state) => ({
      readyEntities: state.readyEntities.includes(id)
        ? state.readyEntities
        : [...state.readyEntities, id],
    })),
  removeReadyEntity: (id) =>
    set((state) => ({
      readyEntities: state.readyEntities.filter((item) => item !== id),
    })),
  replaceReadyEntity: (oldId, newId) =>
    set((state) => {
      const filtered = state.readyEntities.filter((item) => item !== oldId);
      return {
        readyEntities: filtered.includes(newId)
          ? filtered
          : [...filtered, newId],
      };
    }),
  approvedReplacements: {},
  addApprovedReplacement: (originalId, newId) =>
    set((state) => ({
      approvedReplacements: {
        ...state.approvedReplacements,
        [originalId]: newId,
      },
    })),

  addSuggestion: (payload) =>
    set((state) => {
      if (payload.id && state.suggestions.find((s) => s.id === payload.id)) {
        return state;
      }
      return {
        suggestions: [
          ...state.suggestions,
          {
            id:
              payload.id ||
              Date.now().toString() +
                "_" +
                Math.random().toString(36).substring(2, 9),
            stage: payload.stage,
            relatedModule: payload.relatedModule,
            status: "未处理",
            originalSuggestion: payload.originalSuggestion,
            finalSuggestion: "",
            linkedContent: payload.linkedContent,
            triggerSource: payload.triggerSource,
            processedResult: payload.processedResult,
            exclusion: payload.exclusion,
          },
        ],
      };
    }),

  updateSuggestion: (id, status, finalText) =>
    set((state) => ({
      suggestions: state.suggestions.map((item) =>
        item.id === id ? { ...item, status, finalSuggestion: finalText } : item,
      ),
    })),

  setSuggestions: (suggestions) => set({ suggestions }),

  setSelectedDialogueId: (id) => set({ selectedDialogueId: id }),
  setActiveWorkTabKey: (key) => set({ activeWorkTabKey: key }),
  activeBranchId: null,
  setActiveBranchId: (id) => set({ activeBranchId: id }),
  activeCheckedComponentIds: [],
  setActiveCheckedComponentIds: (ids) =>
    set({ activeCheckedComponentIds: ids }),
  activeLinkedResourceIds: [],
  setActiveLinkedResourceIds: (ids) => set({ activeLinkedResourceIds: ids }),
  activeLinkedFrameIds: [],
  setActiveLinkedFrameIds: (ids) => set({ activeLinkedFrameIds: ids }),
  activeRenderedFrameIds: [],
  setActiveRenderedFrameIds: (ids) => set({ activeRenderedFrameIds: ids }),
  activeLinkedAnimationIds: [],
  setActiveLinkedAnimationIds: (ids) => set({ activeLinkedAnimationIds: ids }),
}));

import { useAppStore } from "../store/useAppStore";

export const workflowController = {
  // 1. 初始化对话，触发知识库模块
  startKnowledgePhase: () => {
    const store = useAppStore.getState();
    store.setKnowledgeTriggered(true);
    store.setShowKnowledgeHighlight(true);
    store.setActiveWorkTabKey("knowledge");
  },

  // 2. 完成知识库交互，触发分镜脚本文本
  startScriptPhase: () => {
    const store = useAppStore.getState();
    store.setScriptTriggered(true);
    store.setShowScriptHighlight(true);
    store.setActiveWorkTabKey("script");
  },

  // 3. 完成文本确认，触发分镜头画面
  startFramePhase: () => {
    const store = useAppStore.getState();
    if (!store.isFrameTriggered) {
      store.setFrameTriggered(true);
      store.setShowFrameHighlight(true);
      store.setActiveWorkTabKey("frame");
    }
  },

  // 4. 完成画面绘制，触发动画合成
  startAnimationPhase: () => {
    const store = useAppStore.getState();
    if (!store.isAnimationTriggered) {
      store.setAnimationTriggered(true);
      store.setShowAnimationHighlight(true);
      store.setActiveWorkTabKey("animation");
    }
  },

  // 5. 其他流程状态更新
  completeFramePhase: (isCompleted: boolean = true) => {
    useAppStore.getState().setFrameCompleted(isCompleted);
  },

  completeAnimationPhase: (isCompleted: boolean = true) => {
    useAppStore.getState().setAnimationCompleted(isCompleted);
  },

  completeWorkflow: (isCompleted: boolean = true) => {
    useAppStore.getState().setWorkflowCompleted(isCompleted);
  },

  // 用于点击 Tab 消除红点的高阶方法
  resolveHighlight: (tabKey: string) => {
    const store = useAppStore.getState();
    switch (tabKey) {
      case "knowledge":
        if (store.showKnowledgeHighlight)
          store.setShowKnowledgeHighlight(false);
        break;
      case "script":
        if (store.showScriptHighlight) store.setShowScriptHighlight(false);
        break;
      case "frame":
        if (store.showFrameHighlight) store.setShowFrameHighlight(false);
        break;
      case "animation":
        if (store.showAnimationHighlight)
          store.setShowAnimationHighlight(false);
        break;
    }
  },
};

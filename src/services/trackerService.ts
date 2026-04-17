export interface TrackEvent {
  module: "Work" | "Dialogue" | "Review";
  page?: string; // 对于 Work 模块的具体页面
  action: "enter" | "leave" | "action"; // 进入页面，离开页面，或执行某操作
  duration?: number; // 停留或操作持续时间（毫秒）
  details?: Record<string, any>;
}

class TrackerService {
  private timers: Map<string, number> = new Map();

  /**
   * 开始计时
   * @param id 唯一标识符，例如 'Work_KnowledgePage'
   */
  startTimer(id: string) {
    this.timers.set(id, Date.now());
  }

  /**
   * 停止计时并获取持续时间
   * @param id 唯一标识符
   * @returns 持续时间（毫秒），如果没有找到返回 0
   */
  stopTimer(id: string): number {
    const startTime = this.timers.get(id);
    if (!startTime) return 0;
    this.timers.delete(id);
    return Date.now() - startTime;
  }

  /**
   * 发送埋点日志，存入本地文件 (通过 Vite 插件拦截 /api/log)
   */
  async logEvent(event: TrackEvent) {
    const userId = localStorage.getItem("app_user_id") || "anonymous";
    const payload = {
      timestamp: new Date().toISOString(),
      userId,
      ...event,
    };

    console.log("[Tracker]", payload);

    try {
      await fetch("/api/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to save log locally:", error);
    }
  }
}

export const trackerService = new TrackerService();

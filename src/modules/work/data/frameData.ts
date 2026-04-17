export interface KeyframeData {
  id: string;
  frameId: string;
  title: string;
  description: string;
  imageUrl: string;
  color: string;
}

export interface FrameOfTask {
  Id: string;
  frames: KeyframeData[];
}

export interface FrameDataResponse {
  name: string;
  frameOfTasks: FrameOfTask[];
}

// 获取全部帧数据
export async function fetchAllFrameData(): Promise<{
  name: string;
  keyframes: KeyframeData[];
}> {
  const response = await fetch("/src/modules/work/data/frames.json");
  if (!response.ok) throw new Error("帧数据加载失败");
  const data: FrameDataResponse = await response.json();

  // 扁平化所有的 frames
  const allKeyframes = data.frameOfTasks.flatMap((task) => task.frames);
  return { name: data.name, keyframes: allKeyframes };
}

// 提取特定 ID 列表的帧数据
export async function fetchFrameData(
  frameIds: string[],
): Promise<KeyframeData[]> {
  const response = await fetch("/src/modules/work/data/frames.json");
  if (!response.ok) throw new Error("帧数据加载失败");
  const data: FrameDataResponse = await response.json();

  const result: KeyframeData[] = [];
  data.frameOfTasks.forEach((task) => {
    if (frameIds.includes(task.Id)) {
      result.push(...task.frames);
    } else {
      result.push(
        ...task.frames.filter((frame) => frameIds.includes(frame.id)),
      );
    }
  });

  return result;
}

// 提取特定 frameId 的帧数据
export async function fetchFrameDataByFrameId(
  frameId: string,
): Promise<KeyframeData[]> {
  const data = await fetchAllFrameData();
  return data.keyframes.filter((frame) => frame.frameId === frameId);
}

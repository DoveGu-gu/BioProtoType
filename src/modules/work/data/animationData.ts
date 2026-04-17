export interface AnimationData {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  isReady: boolean;
  triggerFrames?: string[];
}

export interface AnimationOfTask {
  Id: string;
  animations: AnimationData[];
}

export interface AnimationResponse {
  name: string;
  animationsOfTasks: AnimationOfTask[];
}

export async function fetchAllAnimationData(): Promise<{
  name: string;
  animations: AnimationData[];
}> {
  const response = await fetch("/src/modules/work/data/animation.json");
  if (!response.ok) throw new Error("视频数据加载失败");
  const data: AnimationResponse = await response.json();

  const allAnimations = data.animationsOfTasks.flatMap(
    (task) => task.animations,
  );
  return { name: data.name, animations: allAnimations };
}

export async function fetchAnimationData(
  animationIds: string[],
): Promise<AnimationData[]> {
  const response = await fetch("/src/modules/work/data/animation.json");
  if (!response.ok) throw new Error("视频数据加载失败");
  const data: AnimationResponse = await response.json();

  const result: AnimationData[] = [];
  data.animationsOfTasks.forEach((task) => {
    if (animationIds.includes(task.Id)) {
      result.push(...task.animations);
    } else {
      result.push(
        ...task.animations.filter((anim) => animationIds.includes(anim.id)),
      );
    }
  });

  return result;
}

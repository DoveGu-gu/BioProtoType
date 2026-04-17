export interface Storyboard {
  id: string;
  title: string;
  camera: string;
  content: string;
  duration: string;
  relatedResources: string[];
  triggerComponents?: string[];
  linkedFrameIds?: string[];
}

export interface Resource {
  id: string;
  type: string;
  name: string;
  status: string;
}

export interface ScriptItem {
  id: string;
  storyboards: Storyboard[];
  resources: Resource[];
}

export interface ScriptResponse {
  name: string;
  scripts: ScriptItem[];
}

// 获取全部脚本数据
export async function fetchAllScriptData(): Promise<ScriptResponse> {
  const response = await fetch("/src/modules/work/data/script.json");
  if (!response.ok) throw new Error("脚本数据加载失败");
  return await response.json();
}

// 获取特定 ID 的脚本数据
export async function fetchScriptData(
  scriptId: string,
): Promise<ScriptItem | undefined> {
  const data = await fetchAllScriptData();
  return data.scripts.find((s) => s.id === scriptId);
}

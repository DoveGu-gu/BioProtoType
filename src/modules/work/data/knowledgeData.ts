export interface ComponentData {
  id: string;
  name: string;
  explanation: string;
  dafult?: boolean;
  relatedIds?: string[];
  linkedresourceIds?: string[];
}

export interface KnowledgeData {
  id: string;
  processDescription: string;
  components: ComponentData[];
}

export interface KnowledgeResponse {
  name: string;
  knowledges: KnowledgeData[];
}

// 获取全部知识数据
export async function fetchAllKnowledgeData(): Promise<KnowledgeResponse> {
  const response = await fetch("/src/modules/work/data/knowledge.json");
  if (!response.ok) throw new Error("知识数据加载失败");
  return await response.json();
}

// 提取特定 ID 的知识数据
export async function fetchKnowledgeData(
  knowledgeId: string,
): Promise<KnowledgeData | undefined> {
  const data = await fetchAllKnowledgeData();
  return data.knowledges.find((k) => k.id === knowledgeId);
}

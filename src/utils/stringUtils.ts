export function calculateSimilarity(summary: string, taskName: string): number {
  if (summary.length === 0 && taskName.length === 0) return 1.0;
  if (summary.length === 0 || taskName.length === 0) return 0.0;

  // 使用杰卡德相似性系数（Jaccard similarity coefficient）计算相似度
  // 将字符串视为字符集合，计算其交集大小与并集大小的比例
  const setA = new Set(summary);
  const setB = new Set(taskName);

  let intersectionSize = 0;
  for (const char of setA) {
    if (setB.has(char)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;

  //return unionSize === 0 ? 0 : intersectionSize / unionSize;
  return unionSize === 0 ? 0 : intersectionSize / setB.size; // 以任务名称的字符集大小作为分母，衡量总结覆盖了多少任务名称的字符
}

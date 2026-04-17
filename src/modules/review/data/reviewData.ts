// src/modules/review/data/reviewData.ts

export interface ReviewSuggestion {
  id: string;
  stage: string;
  relatedModule?: string;
  triggerSource?: string[];
  originalSuggestion: string;
  linkedContent?: string[];
  processedResult?: string;
  exclusion?: string[];
}

export interface ReviewResponse {
  name: string;
  reviewsOfTasks: {
    Id: string;
    frameReviews: ReviewSuggestion[];
    animationReviews: ReviewSuggestion[];
  }[];
}

export const fetchAllReviewData = async (): Promise<ReviewSuggestion[]> => {
  return new Promise((resolve, reject) => {
    import("./review.json")
      .then((module) => {
        const data = module.default as unknown as ReviewResponse;
        const allReviews =
          data.reviewsOfTasks?.flatMap((task) => [
            ...(task.frameReviews || []),
            ...(task.animationReviews || []),
          ]) || [];
        resolve(allReviews);
      })
      .catch((err) => {
        console.error("加载 review.json 失败:", err);
        reject(err);
      });
  });
};

export const fetchReviewData = async (
  reviewIds: string[],
): Promise<ReviewSuggestion[]> => {
  return new Promise((resolve, reject) => {
    import("./review.json")
      .then((module) => {
        const data = module.default as unknown as ReviewResponse;
        const result: ReviewSuggestion[] = [];
        data.reviewsOfTasks?.forEach((task) => {
          if (reviewIds.includes(task.Id)) {
            result.push(
              ...(task.frameReviews || []),
              ...(task.animationReviews || []),
            );
          } else {
            const allItems = [
              ...(task.frameReviews || []),
              ...(task.animationReviews || []),
            ];
            result.push(...allItems.filter((r) => reviewIds.includes(r.id)));
          }
        });
        // Just return the array
        resolve(result);
      })
      .catch((err) => {
        console.error("加载 review.json 失败:", err);
        reject(err);
      });
  });
};

export type LearningItem = { id: string; title: string; program_id: string; href: string; position: number; completed: boolean };
export function summarizeLearning(items: LearningItem[]) {
  return { total: items.length, completed: items.filter(item => item.completed).length, seconds: items.reduce((sum, item) => sum + Math.max(0, item.position), 0) };
}
export function programLearning(items: LearningItem[], programId: string) {
  const summary = summarizeLearning(items.filter(item => item.program_id === programId));
  return { ...summary, percentage: summary.total ? Math.round(summary.completed / summary.total * 100) : 0 };
}

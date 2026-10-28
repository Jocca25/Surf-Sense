export interface ScoreSnapshot {
  fetchedAt: string;
  scores: Record<string, number>;
}

export interface ScoreChange {
  spotId: string;
  before: number;
  after: number;
  delta: number;
}

/** Compare the best near-term score from the last visit with the one just loaded. */
export function diffSnapshots(previous: ScoreSnapshot | null, next: ScoreSnapshot): ScoreChange[] {
  if (!previous || previous.fetchedAt === next.fetchedAt) return [];
  const changes: ScoreChange[] = [];
  for (const [spotId, after] of Object.entries(next.scores)) {
    const before = previous.scores[spotId];
    if (before == null || !Number.isFinite(before) || !Number.isFinite(after)) continue;
    const delta = Math.round(after - before);
    if (Math.abs(delta) < 5) continue;
    changes.push({ spotId, before: Math.round(before), after: Math.round(after), delta });
  }
  return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/**
 * A place to keep what a person actually found in the water.
 * The current app only stores these notes. It does not train a model on them.
 * Later, a model could learn from this shape together with the forecast that was shown.
 */
export interface SurfSessionFeedback {
  id: string;
  spotId: string;
  /** Civil time, in the beach's timezone, when the person was in the water. */
  sessionTime: string;
  /** 1 felt poor, 5 felt excellent. This is a memory, not a new forecast. */
  rating: 1 | 2 | 3 | 4 | 5;
  note?: string;
  recordedAt: string;
}

export interface StoredForecastSample {
  spotId: string;
  time: string;
  score: number | null;
  waveQuality: number | null;
  sizeM: number | null;
  swellDirectionDeg: number | null;
  periodS: number | null;
  windSpeedKmh: number | null;
  windKind: string | null;
  tidePosition: number | null;
}

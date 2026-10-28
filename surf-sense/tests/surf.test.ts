import { describe, expect, it } from "vitest";
import { angularDistance, compass16, distanceToArc, inArc, normalizeDegrees, signedAngleDiff } from "@/lib/angles";
import { getBeach, type Beach } from "@/lib/beaches";
import { diffSnapshots } from "@/lib/changes";
import { explainWindow } from "@/lib/explanations";
import { parseWarnings } from "@/lib/forecast/ipma";
import { parseWorldTides } from "@/lib/forecast/worldtides";
import { evaluateAlerts, type AlertForecast } from "@/lib/notifications";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/preferences";
import { scoreHour, type ScoringHourInput } from "@/lib/scoring";
import { annotateTideLevels, findExtremes } from "@/lib/tides";
import { utcToZonedLocalIso, zonedLocalToUtc } from "@/lib/time";
import { findWindows, windShifts } from "@/lib/windows";
import { classifyWind } from "@/lib/wind";

const carcavelos = getBeach("carcavelos") as Beach;
const caparica = getBeach("caparica") as Beach;
const praiaGrande = getBeach("praia-grande") as Beach;
const guincho = getBeach("guincho") as Beach;

function prefs(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...overrides,
    favoriteIds: overrides.favoriteIds ?? ["carcavelos"],
    notifications: {
      ...DEFAULT_PREFERENCES.notifications,
      enabled: true,
      spotIds: ["carcavelos"],
      ...overrides.notifications,
    },
  };
}

function goodHour(time: string, overrides: Partial<ScoringHourInput> = {}): ScoringHourInput {
  return {
    time,
    waveHeightM: 1.3,
    waveDirectionDeg: 280,
    wavePeriodS: 11,
    swellHeightM: 1.2,
    swellDirectionDeg: 280,
    swellPeriodS: 11,
    windWaveHeightM: 0.2,
    windWaveDirectionDeg: 280,
    windWavePeriodS: 5,
    windSpeedKmh: 10,
    windDirectionDeg: 75,
    windGustKmh: 14,
    seaTemperatureC: 17,
    tide: {
      levelM: 0.2,
      position: 0.5,
      phase: "rising",
      label: "meia-maré, a encher",
      confidence: "ok",
      previousExtreme: null,
      nextExtreme: null,
    },
    ...overrides,
  };
}

describe("compass wrap", () => {
  it("treats 0° and 360° as the same point", () => {
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(-10)).toBe(350);
    expect(compass16(0)).toBe("N");
    expect(compass16(359)).toBe("N");
    expect(angularDistance(350, 10)).toBe(20);
  });

  it("keeps a signed turn inside the open-closed range around north", () => {
    expect(signedAngleDiff(10, 350)).toBe(-20);
    expect(signedAngleDiff(350, 10)).toBe(20);
    expect(signedAngleDiff(0, 180)).toBe(180);
    expect(signedAngleDiff(5, 185)).toBe(180);
  });

  it("accepts an arc that crosses north", () => {
    expect(inArc(350, 340, 20)).toBe(true);
    expect(inArc(10, 340, 20)).toBe(true);
    expect(inArc(180, 340, 20)).toBe(false);
    expect(distanceToArc(180, 340, 20)).toBe(160);
    expect(distanceToArc(0, 340, 20)).toBe(0);
  });
});

describe("wind relative to the beach", () => {
  it("calls an east wind offshore on a west-facing beach and onshore on an east-facing beach", () => {
    expect(classifyWind(90, 270).kind).toBe("offshore");
    expect(classifyWind(90, 90).kind).toBe("onshore");
    expect(classifyWind(0, 270).kind).toBe("cross-shore");
    expect(classifyWind(180, 270).kind).toBe("cross-shore");
  });

  it("classifies the bands between offshore and onshore", () => {
    expect(classifyWind(270, 270).kind).toBe("onshore");
    expect(classifyWind(230, 270).kind).toBe("cross-onshore");
    expect(classifyWind(140, 270).kind).toBe("cross-offshore");
    expect(classifyWind(90, 270).kind).toBe("offshore");
  });

  it("wraps around north instead of treating 350° as a long way from 10°", () => {
    expect(classifyWind(350, 10).kind).toBe("onshore");
    expect(classifyWind(10, 350).kind).toBe("onshore");
    expect(classifyWind(180, 0).kind).toBe("offshore");
    expect(classifyWind(90, 0).kind).toBe("cross-shore");
    expect(classifyWind(360, 0).kind).toBe("onshore");
  });

  it("does not use one fixed compass direction for every beach", () => {
    const north = 0;
    const guinchoWind = classifyWind(north, guincho.facingDeg);
    const grandeWind = classifyWind(north, praiaGrande.facingDeg);
    expect(guinchoWind.kind).not.toBe(grandeWind.kind);
  });

  it("still calls a dangerous easterly offshore, and then refuses to score it as excellent", () => {
    const scored = scoreHour({
      beach: carcavelos,
      hour: goodHour("2026-10-28T14:00", { windSpeedKmh: 62, windGustKmh: 80, windDirectionDeg: 75 }),
      preferences: prefs(),
    });
    expect(scored.wind?.kind).toBe("offshore");
    expect(scored.safety).toBe("danger");
    expect(scored.waveQuality).toBeGreaterThan(39);
    expect(scored.score).toBeLessThanOrEqual(39);
    expect(scored.category).toBe("poor");
  });
});

describe("surf score", () => {
  it("scores a clean, well-aimed swell higher than a direction the beach does not take", () => {
    const aimed = scoreHour({
      beach: praiaGrande,
      hour: goodHour("2026-10-28T14:00", { swellDirectionDeg: 320, waveDirectionDeg: 320, windDirectionDeg: 130 }),
      preferences: prefs(),
    });
    const sheltered = scoreHour({
      beach: caparica,
      hour: goodHour("2026-10-28T14:00", { swellDirectionDeg: 320, waveDirectionDeg: 320, windDirectionDeg: 85 }),
      preferences: prefs(),
    });
    const aimedDirection = aimed.factors.find((factor) => factor.key === "swellDirection")?.score;
    const shelteredDirection = sheltered.factors.find((factor) => factor.key === "swellDirection")?.score;
    expect(aimedDirection).toBe(100);
    expect(shelteredDirection).toBeLessThan(70);
  });

  it("gives a beginner a lower height score than an advanced surfer in large surf", () => {
    const wide = prefs({ waveMinM: 0.3, waveMaxM: 4 });
    const hour = goodHour("2026-10-28T14:00", { swellHeightM: 2.2, waveHeightM: 2.3 });
    const beginner = scoreHour({ beach: guincho, hour, preferences: { ...wide, skill: "beginner" } });
    const intermediate = scoreHour({ beach: guincho, hour, preferences: { ...wide, skill: "intermediate" } });
    const advanced = scoreHour({ beach: guincho, hour, preferences: { ...wide, skill: "advanced" } });
    const read = (result: typeof beginner) => result.factors.find((factor) => factor.key === "swellHeight")?.score ?? 0;
    expect(read(beginner)).toBeLessThan(read(intermediate));
    expect(read(intermediate)).toBeLessThan(read(advanced));
  });

  it("drops the tide out of the average when the tide is missing", () => {
    const withTide = scoreHour({ beach: carcavelos, hour: goodHour("2026-10-28T14:00"), preferences: prefs() });
    const withoutTide = scoreHour({
      beach: carcavelos,
      hour: goodHour("2026-10-28T14:00", { tide: null }),
      preferences: prefs(),
    });
    expect(withoutTide.factors.find((factor) => factor.key === "tide")?.available).toBe(false);
    const usable = withoutTide.factors.filter((factor) => factor.available && factor.score != null);
    const weight = usable.reduce((sum, factor) => sum + factor.weight, 0);
    const expected = Math.round(usable.reduce((sum, factor) => sum + (factor.score as number) * factor.weight, 0) / weight);
    expect(withoutTide.waveQuality).toBe(expected);
    expect(withoutTide.score).not.toBeNull();
    expect(withTide.factors.find((factor) => factor.key === "tide")?.available).toBe(true);
  });

  it("does not invent a score when the wave height and the wind are missing", () => {
    const scored = scoreHour({
      beach: carcavelos,
      hour: goodHour("2026-10-28T14:00", {
        swellHeightM: null,
        waveHeightM: null,
        windSpeedKmh: null,
        windDirectionDeg: null,
      }),
      preferences: prefs(),
    });
    expect(scored.score).toBeNull();
    expect(scored.confidence).toBe("insufficient");
    expect(scored.missing).toEqual(expect.arrayContaining(["altura da ondulação", "vento"]));
  });
});

describe("tides", () => {
  it("finds high and low water on a regular curve and tells rising from falling", () => {
    const start = Date.parse("2026-01-15T00:00:00Z");
    const samples = Array.from({ length: 30 }, (_, index) => ({
      time: utcToZonedLocalIso(new Date(start + index * 60 * 60 * 1000), "Europe/Lisbon"),
      levelM: Math.cos((index / 12) * Math.PI * 2),
    }));
    const extremes = findExtremes(samples, true);
    expect(extremes.some((extreme) => extreme.kind === "high")).toBe(true);
    expect(extremes.some((extreme) => extreme.kind === "low")).toBe(true);
    const annotated = annotateTideLevels(samples.map((sample) => ({ time: sample.time, tideLevelM: sample.levelM })));
    const rising = annotated.byTime.get(samples[9].time);
    expect(rising?.phase).toBe("rising");
    expect(rising?.position).toBeGreaterThan(0.4);
    expect(rising?.position).toBeLessThan(0.6);
  });

  it("leaves a gap instead of inventing a tide", () => {
    const annotated = annotateTideLevels([
      { time: "2026-01-15T00:00", tideLevelM: null },
      { time: "2026-01-15T01:00", tideLevelM: null },
    ]);
    expect(annotated.byTime.get("2026-01-15T00:00")).toBeNull();
    expect(annotated.extremes).toHaveLength(0);
  });
});

describe("time zones", () => {
  it("reads Lisbon civil time in winter and in summer", () => {
    expect(zonedLocalToUtc("2026-01-15T12:00", "Europe/Lisbon").toISOString()).toBe("2026-01-15T12:00:00.000Z");
    expect(zonedLocalToUtc("2026-07-15T12:00", "Europe/Lisbon").toISOString()).toBe("2026-07-15T11:00:00.000Z");
  });
});

describe("windows and changes", () => {
  it("ranks a clean afternoon above a windy morning", () => {
    const user = prefs({ minScore: 65 });
    const hours = [9, 10, 11, 14, 15, 16].map((hour) =>
      scoreHour({
        beach: carcavelos,
        hour: goodHour(`2026-10-28T${String(hour).padStart(2, "0")}:00`, {
          windSpeedKmh: hour < 12 ? 34 : 10,
          windGustKmh: hour < 12 ? 40 : 14,
        }),
        preferences: user,
      }),
    );
    const windows = findWindows(hours, new Date("2026-10-28T08:00:00Z"), "Europe/Lisbon", 65);
    expect(windows[0].start.endsWith("14:00")).toBe(true);
    expect(windows[0].recommended).toBe(true);
    const text = explainWindow(carcavelos, windows[0]);
    expect(text).toContain("1,2");
    expect(text).toContain("11");
    expect(text.toLowerCase()).not.toContain("nan");
    expect(text).not.toContain("undefined");
  });

  it("notices a wind shift", () => {
    const user = prefs();
    const hours = [12, 13, 16].map((hour, index) =>
      scoreHour({
        beach: carcavelos,
        hour: goodHour(`2026-10-28T${hour}:00`, {
          windDirectionDeg: index === 2 ? 255 : 75,
          windSpeedKmh: index === 2 ? 28 : 10,
        }),
        preferences: user,
      }),
    );
    const shifts = windShifts(hours);
    expect(shifts.some((shift) => shift.from !== shift.to)).toBe(true);
  });

  it("ignores tiny score changes and a repeated fetch", () => {
    const previous = { fetchedAt: "2026-10-28T08:00:00Z", scores: { carcavelos: 70, guincho: 60 } };
    const next = { fetchedAt: "2026-10-28T10:00:00Z", scores: { carcavelos: 78, guincho: 62 } };
    expect(diffSnapshots(previous, next).map((change) => change.spotId)).toEqual(["carcavelos"]);
    expect(diffSnapshots(next, next)).toEqual([]);
  });
});

describe("notifications", () => {
  const now = new Date("2026-10-28T13:00:00Z");

  function forecastFrom(hours: ScoringHourInput[], overrides: Partial<AlertForecast> = {}): AlertForecast {
    const user = prefs();
    const scored = hours.map((hour) => scoreHour({ beach: carcavelos, hour, preferences: user }));
    return {
      beach: carcavelos,
      hours: scored,
      windows: findWindows(scored, now, "Europe/Lisbon", user.minScore),
      stale: false,
      uncertain: false,
      forecastIssuedAt: "2026-10-28T12:00:00Z",
      ...overrides,
    };
  }

  const clean = () =>
    forecastFrom([14, 15, 16].map((hour) => goodHour(`2026-10-28T${hour}:00`)));

  it("stays silent until alerts are turned on", () => {
    const decisions = evaluateAlerts({
      now,
      preferences: prefs({ notifications: { ...DEFAULT_PREFERENCES.notifications, enabled: false } }),
      forecasts: [clean()],
      alreadySent: [],
    });
    expect(decisions.every((decision) => decision.action === "skip" && decision.reason === "opt-out")).toBe(true);
  });

  it("sends one forecast alert and then refuses the duplicate", () => {
    const first = evaluateAlerts({
      now,
      preferences: prefs(),
      forecasts: [clean()],
      alreadySent: [],
    });
    const sent = first.find((decision) => decision.action === "send");
    expect(sent?.action).toBe("send");
    if (sent?.action !== "send") return;
    expect(sent.alert.kind).toBe("forecast");
    expect(sent.alert.summary).toContain("previsão");
    expect(sent.alert.summary).toContain(String(sent.alert.score));
    const second = evaluateAlerts({
      now,
      preferences: prefs(),
      forecasts: [clean()],
      alreadySent: [{ id: sent.alert.id, fingerprint: sent.alert.fingerprint, sentAt: now.toISOString() }],
    });
    expect(second.some((decision) => decision.action === "send")).toBe(false);
    expect(second.some((decision) => decision.action === "skip" && decision.reason === "duplicate")).toBe(true);
  });

  it("sends an update when the forecast fingerprint changes", () => {
    const original = clean();
    const first = evaluateAlerts({ now, preferences: prefs(), forecasts: [original], alreadySent: [] });
    const sent = first.find((decision) => decision.action === "send");
    if (sent?.action !== "send") throw new Error("expected a first alert");
    const changed = forecastFrom(
      [14, 15, 16].map((hour) => goodHour(`2026-10-28T${hour}:00`, { windSpeedKmh: 22, windGustKmh: 28 })),
    );
    const second = evaluateAlerts({
      now,
      preferences: prefs(),
      forecasts: [changed],
      alreadySent: [{ id: sent.alert.id, fingerprint: sent.alert.fingerprint, sentAt: now.toISOString() }],
    });
    const update = second.find((decision) => decision.action === "send");
    expect(update?.action).toBe("send");
    if (update?.action === "send") expect(update.alert.update).toBe(true);
  });

  it("holds the alert during quiet hours without marking it sent", () => {
    const night = new Date("2026-10-28T23:30:00Z");
    const morning = forecastFrom(
      [9, 10, 11].map((hour) => goodHour(`2026-10-29T${String(hour).padStart(2, "0")}:00`)),
    );
    morning.windows = findWindows(
      morning.hours,
      night,
      "Europe/Lisbon",
      prefs().minScore,
    );
    const decisions = evaluateAlerts({
      now: night,
      preferences: prefs(),
      forecasts: [morning],
      alreadySent: [],
    });
    expect(decisions.some((decision) => decision.action === "send")).toBe(false);
    expect(decisions.some((decision) => decision.action === "defer")).toBe(true);
  });

  it("skips alerts below the score, outside the wave range, or above the wind limit", () => {
    const sample = clean();
    const lowScore = evaluateAlerts({
      now,
      preferences: prefs({ notifications: { ...prefs().notifications, minScore: 101 } }),
      forecasts: [sample],
      alreadySent: [],
    });
    const smallWaves = evaluateAlerts({
      now,
      preferences: prefs({ notifications: { ...prefs().notifications, waveMinM: 0.2, waveMaxM: 0.4 } }),
      forecasts: [sample],
      alreadySent: [],
    });
    const windy = evaluateAlerts({
      now,
      preferences: prefs({ notifications: { ...prefs().notifications, maxWindKmh: 5 } }),
      forecasts: [sample],
      alreadySent: [],
    });
    expect(lowScore.some((decision) => decision.action === "skip" && decision.reason === "below-score")).toBe(true);
    expect(smallWaves.some((decision) => decision.action === "skip" && decision.reason === "wave-range")).toBe(true);
    expect(windy.some((decision) => decision.action === "skip" && decision.reason === "wind")).toBe(true);
  });

  it("does not alert when essential data is missing, the feed is stale, or the models disagree", () => {
    const missingTide = forecastFrom([14, 15, 16].map((hour) => goodHour(`2026-10-28T${hour}:00`, { tide: null })));
    const stale = evaluateAlerts({
      now,
      preferences: prefs(),
      forecasts: [{ ...clean(), stale: true }],
      alreadySent: [],
    });
    const uncertain = evaluateAlerts({
      now,
      preferences: prefs(),
      forecasts: [{ ...clean(), uncertain: true }],
      alreadySent: [],
    });
    const incomplete = evaluateAlerts({
      now,
      preferences: prefs(),
      forecasts: [missingTide],
      alreadySent: [],
    });
    expect(stale[0]).toMatchObject({ action: "skip", reason: "stale" });
    expect(uncertain[0]).toMatchObject({ action: "skip", reason: "uncertain" });
    expect(incomplete.some((decision) => decision.action === "send")).toBe(false);
  });

  it("does not alert on dangerous hours or on a window too far ahead", () => {
    const dangerous = forecastFrom(
      [14, 15, 16].map((hour) => goodHour(`2026-10-28T${hour}:00`, { windSpeedKmh: 62, windGustKmh: 80 })),
    );
    const laterNow = new Date("2026-10-28T08:00:00Z");
    const distantHours = [14, 15, 16].map((hour) => goodHour(`2026-10-30T${hour}:00`));
    const distantScored = distantHours.map((hour) => scoreHour({ beach: carcavelos, hour, preferences: prefs() }));
    const distant: AlertForecast = {
      beach: carcavelos,
      hours: distantScored,
      windows: findWindows(distantScored, laterNow, "Europe/Lisbon", 65),
      stale: false,
      uncertain: false,
      forecastIssuedAt: laterNow.toISOString(),
    };
    const dangerDecision = evaluateAlerts({ now, preferences: prefs(), forecasts: [dangerous], alreadySent: [] });
    const farDecision = evaluateAlerts({
      now: laterNow,
      preferences: prefs({ notifications: { ...prefs().notifications, leadHours: 12 } }),
      forecasts: [distant],
      alreadySent: [],
    });
    expect(dangerDecision.some((decision) => decision.action === "send")).toBe(false);
    expect(farDecision.some((decision) => decision.action === "skip" && decision.reason === "too-far")).toBe(true);
  });
});

describe("upstream parsers", () => {
  it("keeps only yellow, orange and red IPMA warnings", () => {
    const warnings = parseWarnings([
      {
        text: "",
        awarenessTypeName: "Vento",
        idAreaAviso: "LSB",
        startTime: "2026-10-28T00:00:00",
        endTime: "2026-10-28T12:00:00",
        awarenessLevelID: "green",
      },
      {
        text: "Vento forte",
        awarenessTypeName: "Vento",
        idAreaAviso: "LSB",
        startTime: "2026-10-28T12:00:00",
        endTime: "2026-10-28T20:00:00",
        awarenessLevelID: "orange",
      },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].awarenessLevelID).toBe("orange");
  });

  it("reads WorldTides heights without treating them as an observation", () => {
    const parsed = parseWorldTides({
      status: 200,
      heights: [{ dt: Date.parse("2026-01-15T03:00:00Z") / 1000, height: 3.2 }],
      extremes: [{ dt: Date.parse("2026-01-15T03:10:00Z") / 1000, height: 3.4, type: "High" }],
    });
    expect(parsed.levels[0].levelM).toBe(3.2);
    expect(parsed.extremes[0].kind).toBe("high");
    expect(parsed.extremes[0].approximate).toBe(false);
  });
});

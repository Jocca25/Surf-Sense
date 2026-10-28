"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BEACHES, getBeach } from "@/lib/beaches";
import { diffSnapshots, type ScoreChange, type ScoreSnapshot } from "@/lib/changes";
import type { ForecastBundle } from "@/lib/forecast/types";
import { evaluateAlerts, type AlertCandidate, type SentAlert } from "@/lib/notifications";
import {
  DEFAULT_PREFERENCES,
  sanitizePreferences,
  type NotificationPrefs,
  type UserPreferences,
} from "@/lib/preferences";
import { buildSpotReport, nearTermScore, type SpotReport } from "@/lib/report";
import { isQuietHour, zonedHour } from "@/lib/time";

const PREF_KEY = "barlavento.preferences.v1";
const SNAPSHOT_KEY = "barlavento.snapshot.v1";
const SENT_KEY = "barlavento.alerts.sent.v1";
const INBOX_KEY = "barlavento.alerts.inbox.v1";

interface AppContextValue {
  ready: boolean;
  loading: boolean;
  error: string | null;
  preferences: UserPreferences;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  updateNotifications: (patch: Partial<NotificationPrefs>) => void;
  toggleFavorite: (id: string) => void;
  reports: SpotReport[];
  changes: ScoreChange[];
  inbox: AlertCandidate[];
  dismissAlert: (id: string) => void;
  clearInbox: () => void;
  refresh: () => void;
  fetchedAt: string | null;
  now: Date;
  quietNow: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);
const CLOCK_BEFORE_FORECAST = new Date(0);

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [bundle, setBundle] = useState<ForecastBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<ScoreChange[]>([]);
  const [inbox, setInbox] = useState<AlertCandidate[]>([]);
  const sentRef = useRef<SentAlert[]>([]);
  const snapshotSaved = useRef<string | null>(null);

  useEffect(() => {
    setPreferences(sanitizePreferences(readStorage(PREF_KEY, DEFAULT_PREFERENCES)));
    sentRef.current = readStorage<SentAlert[]>(SENT_KEY, []);
    setInbox(readStorage<AlertCandidate[]>(INBOX_KEY, []));
    setReady(true);
  }, []);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(force ? "/api/forecast?refresh=1" : "/api/forecast");
      const payload = (await response.json()) as ForecastBundle & { message?: string };
      if (!response.ok && (!payload.spots || payload.spots.length === 0)) {
        throw new Error(payload.message || "Não consegui obter a previsão.");
      }
      setBundle(payload);
      if (payload.message && payload.spots.every((spot) => !spot.marineOk && !spot.windOk)) {
        setError(payload.message);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não consegui obter a previsão.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  const now = useMemo(
    () => (bundle?.fetchedAt ? new Date(bundle.fetchedAt) : CLOCK_BEFORE_FORECAST),
    [bundle?.fetchedAt],
  );

  const reports = useMemo(() => {
    if (!bundle || !ready) return [];
    return bundle.spots.flatMap((forecast) => {
      const beach = getBeach(forecast.spotId);
      if (!beach) return [];
      return [buildSpotReport(beach, forecast, preferences, now)];
    });
  }, [bundle, preferences, ready, now]);

  useEffect(() => {
    if (!ready || !bundle || reports.length === 0 || snapshotSaved.current === bundle.fetchedAt) return;
    const scores: Record<string, number> = {};
    for (const report of reports) {
      const score = nearTermScore(report, now);
      if (score != null) scores[report.beach.id] = score;
    }
    const next: ScoreSnapshot = { fetchedAt: bundle.fetchedAt, scores };
    const previous = readStorage<ScoreSnapshot | null>(SNAPSHOT_KEY, null);
    setChanges(diffSnapshots(previous, next));
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
    snapshotSaved.current = bundle.fetchedAt;
  }, [bundle, now, ready, reports]);

  useEffect(() => {
    if (!ready || !bundle || reports.length === 0 || !preferences.notifications.enabled) return;
    const decisions = evaluateAlerts({
      now,
      preferences,
      alreadySent: sentRef.current,
      forecasts: reports
        .filter((report) => report.forecast.marineOk)
        .map((report) => ({
          beach: report.beach,
          hours: report.hours,
          windows: report.windows,
          stale: report.forecast.stale,
          uncertain: report.forecast.marineUncertain,
          forecastIssuedAt: report.forecast.fetchedAt,
        })),
    });
    const sends = decisions.flatMap((decision) => (decision.action === "send" ? [decision.alert] : []));
    if (sends.length === 0) return;
    const nextSent = [...sentRef.current];
    for (const alert of sends) {
      const index = nextSent.findIndex((item) => item.id === alert.id);
      const record = { id: alert.id, fingerprint: alert.fingerprint, sentAt: new Date().toISOString() };
      if (index >= 0) nextSent[index] = record;
      else nextSent.push(record);
    }
    sentRef.current = nextSent;
    localStorage.setItem(SENT_KEY, JSON.stringify(nextSent));
    setInbox((current) => {
      const next = [...sends.reverse(), ...current].slice(0, 40);
      localStorage.setItem(INBOX_KEY, JSON.stringify(next));
      return next;
    });
    if (
      preferences.notifications.channels.browser &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      for (const alert of sends) {
        new Notification(`Previsão · ${alert.spotName}`, { body: alert.summary });
      }
    }
  }, [bundle, now, preferences, ready, reports]);

  const persist = useCallback((next: UserPreferences) => {
    const clean = sanitizePreferences(next);
    setPreferences(clean);
    localStorage.setItem(PREF_KEY, JSON.stringify(clean));
  }, []);

  const updatePreferences = useCallback(
    (patch: Partial<UserPreferences>) => {
      persist({ ...preferences, ...patch });
    },
    [persist, preferences],
  );

  const updateNotifications = useCallback(
    (patch: Partial<NotificationPrefs>) => {
      persist({ ...preferences, notifications: { ...preferences.notifications, ...patch } });
    },
    [persist, preferences],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const favoriteIds = preferences.favoriteIds.includes(id)
        ? preferences.favoriteIds.filter((item) => item !== id)
        : [...preferences.favoriteIds, id];
      persist({ ...preferences, favoriteIds });
    },
    [persist, preferences],
  );

  const dismissAlert = useCallback((id: string) => {
    setInbox((current) => {
      const next = current.filter((alert) => alert.id !== id);
      localStorage.setItem(INBOX_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearInbox = useCallback(() => {
    setInbox([]);
    localStorage.setItem(INBOX_KEY, "[]");
  }, []);

  const quietNow = isQuietHour(
    zonedHour(now, "Europe/Lisbon"),
    preferences.notifications.quietStartHour,
    preferences.notifications.quietEndHour,
  );

  const value: AppContextValue = {
    ready,
    loading: loading || !ready,
    error,
    preferences,
    updatePreferences,
    updateNotifications,
    toggleFavorite,
    reports,
    changes,
    inbox,
    dismissAlert,
    clearInbox,
    refresh: () => void refresh(true),
    fetchedAt: bundle?.fetchedAt ?? null,
    now,
    quietNow: preferences.notifications.enabled && quietNow,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp tem de estar dentro do fornecedor da aplicação.");
  return context;
}

export function useReport(spotId: string) {
  const { reports } = useApp();
  return reports.find((report) => report.beach.id === spotId);
}

export const beachCount = BEACHES.length;

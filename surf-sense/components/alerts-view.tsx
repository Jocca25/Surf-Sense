"use client";

import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BEACHES } from "@/lib/beaches";

const LEAD = [
  { value: "6", label: "6 horas" },
  { value: "12", label: "12 horas" },
  { value: "24", label: "24 horas" },
  { value: "36", label: "36 horas" },
  { value: "48", label: "48 horas" },
  { value: "72", label: "3 dias" },
];

export function AlertsView() {
  const { preferences, updateNotifications, inbox, dismissAlert, clearInbox, quietNow, toggleFavorite } = useApp();
  const settings = preferences.notifications;
  const spots = settings.spotIds.length > 0 ? settings.spotIds : preferences.favoriteIds;

  async function enableBrowser(next: boolean) {
    if (!next) {
      updateNotifications({ channels: { ...settings.channels, browser: false } });
      return;
    }
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    updateNotifications({ channels: { ...settings.channels, browser: permission === "granted" } });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-4xl text-navy">Alertas</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Nada é enviado até ligares os alertas. Cada aviso fala de uma previsão, nunca de uma observação, e não se repete se o mar não mudar.
        </p>
      </header>

      <section className="flex items-center justify-between rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
        <div>
          <Label htmlFor="alerts-enabled">Quero ser avisado</Label>
          <p className="mt-1 text-sm text-muted-foreground">Desligado por omissão.</p>
        </div>
        <Switch id="alerts-enabled" checked={settings.enabled} onCheckedChange={(checked) => updateNotifications({ enabled: checked })} />
      </section>

      {quietNow ? (
        <p className="rounded-2xl bg-sand/60 px-4 py-3 text-sm">Estás em hora de silêncio. O alerta fica guardado e sai quando a pausa acabar, se a janela ainda for futura.</p>
      ) : null}

      <section className="space-y-5 rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
        <h2 className="font-serif text-2xl text-navy">Quando avisar</h2>
        <Field label={`Pontuação mínima: ${Math.round(settings.minScore)}`}>
          <Slider min={0} max={100} step={1} value={[settings.minScore]} onValueChange={(value) => updateNotifications({ minScore: sliderNumber(value, settings.minScore) })} />
        </Field>
        <Field label={`Onda entre ${settings.waveMinM.toFixed(1)} e ${settings.waveMaxM.toFixed(1)} m`}>
          <Slider
            min={0.2}
            max={4}
            step={0.1}
            value={[settings.waveMinM, settings.waveMaxM]}
            onValueChange={(value) => {
              const pair = sliderPair(value);
              if (!pair) return;
              updateNotifications({ waveMinM: Math.min(pair[0], pair[1]), waveMaxM: Math.max(pair[0], pair[1]) });
            }}
          />
        </Field>
        <Field label={`Vento até ${Math.round(settings.maxWindKmh)} km/h`}>
          <Slider min={5} max={80} step={1} value={[settings.maxWindKmh]} onValueChange={(value) => updateNotifications({ maxWindKmh: sliderNumber(value, settings.maxWindKmh) })} />
        </Field>
        <Field label="Com quanta antecedência">
          <Select
            value={String(settings.leadHours)}
            items={LEAD}
            onValueChange={(value) => value && updateNotifications({ leadHours: Number(value) })}
          >
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <HourSelect
            label="Silêncio desde"
            value={settings.quietStartHour}
            onChange={(hour) => updateNotifications({ quietStartHour: hour })}
          />
          <HourSelect
            label="Silêncio até"
            value={settings.quietEndHour}
            onChange={(hour) => updateNotifications({ quietEndHour: hour })}
          />
        </div>
        <p className="text-xs text-muted-foreground">Se as duas horas forem iguais, não há pausa. O silêncio usa a hora de Lisboa.</p>
      </section>

      <section className="rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
        <h2 className="font-serif text-2xl text-navy">Praias</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {settings.spotIds.length === 0 ? "Sem escolha própria: uso as favoritas." : "Só estas praias geram alerta."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {BEACHES.map((beach) => {
            const on = spots.includes(beach.id);
            return (
              <button
                key={beach.id}
                type="button"
                onClick={() => {
                  const current = settings.spotIds.length > 0 ? settings.spotIds : [];
                  const next = current.includes(beach.id)
                    ? current.filter((id) => id !== beach.id)
                    : [...current, beach.id];
                  updateNotifications({ spotIds: next });
                }}
                className={`rounded-full px-3 py-1.5 text-sm ring-1 ${on ? "bg-navy text-primary-foreground ring-navy" : "ring-foreground/15"}`}
              >
                {beach.name}
              </button>
            );
          })}
        </div>
        <button type="button" className="mt-3 text-sm text-ocean" onClick={() => updateNotifications({ spotIds: [] })}>
          Voltar às favoritas
        </button>
        <button type="button" className="mt-3 ml-4 text-sm text-ocean" onClick={() => spots.forEach((id) => {
          if (!preferences.favoriteIds.includes(id)) toggleFavorite(id);
        })}>
          Guardar esta escolha nas favoritas
        </button>
      </section>

      <section className="space-y-3 rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
        <h2 className="font-serif text-2xl text-navy">Como chegar até ti</h2>
        <div className="flex items-center justify-between">
          <Label htmlFor="channel-app">Dentro da aplicação</Label>
          <Switch
            id="channel-app"
            checked={settings.channels.inApp}
            onCheckedChange={(checked) => updateNotifications({ channels: { ...settings.channels, inApp: checked } })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="channel-browser">Notificação do navegador</Label>
            <p className="text-xs text-muted-foreground">Só aparece com esta página aberta. Avisos com o telemóvel fechado pedem um serviço à parte, descrito no README.</p>
          </div>
          <Switch id="channel-browser" checked={settings.channels.browser} onCheckedChange={(checked) => void enableBrowser(checked)} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-navy">Caixa de entrada</h2>
          {inbox.length > 0 ? (
            <Button variant="outline" onClick={clearInbox}>
              Limpar
            </Button>
          ) : null}
        </div>
        {inbox.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Ainda não há alertas. Se os ligares, aparecem aqui quando a previsão encaixar.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {inbox.map((alert) => (
              <li key={`${alert.id}-${alert.fingerprint}`} className="rounded-3xl bg-paper p-4 ring-1 ring-foreground/10">
                <p className="text-xs text-muted-foreground">{alert.update ? "Atualização" : "Previsão"} · {alert.score}/100</p>
                <p className="mt-1 text-sm leading-relaxed">{alert.summary}</p>
                <button type="button" className="mt-2 text-sm text-ocean" onClick={() => dismissAlert(alert.id)}>
                  Dispensar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function sliderNumber(value: number | readonly number[], fallback: number): number {
  const next = Array.isArray(value) ? value[0] : value;
  return next ?? fallback;
}

function sliderPair(value: number | readonly number[]): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  return [value[0], value[1]];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}

function HourSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (hour: number) => void;
}) {
  const items = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: `${String(hour).padStart(2, "0")}:00`,
  }));
  return (
    <label className="block space-y-2 text-sm">
      <span>{label}</span>
      <Select value={String(value ?? 0)} items={items} onValueChange={(next) => next && onChange(Number(next))}>
        <SelectTrigger className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

import React, { useEffect, useState } from 'react';
import { CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { gameService } from '../services/gameService';
import { Area, FoxPrediction } from '../types';

interface Props {
  areas: Area[];
  visible: boolean;
  /** Bumps to force a refetch (e.g. after a new hunt/hint via socket). */
  refreshKey?: number;
}

// Per-area marker colour so multiple foxes' predictions stay distinguishable.
const AREA_COLORS: Record<string, string> = {
  Alpha: '#dc2626', Bravo: '#2563eb', Charlie: '#16a34a', Delta: '#ca8a04',
  Echo: '#9333ea', Foxtrot: '#db2777', Golf: '#0891b2', Hotel: '#ea580c',
};

const colorFor = (name: string) => AREA_COLORS[name] || '#6b7280';

const confidenceLabel = (c: number, t: any) =>
  c >= 0.5 ? t('prediction.confHigh') : c >= 0.2 ? t('prediction.confMedium') : t('prediction.confLow');

// Cap heatmap points drawn per fox so the map stays responsive.
const MAX_HEAT_POINTS = 120;
const HEAT_MIN_WEIGHT = 0.15;

const FoxPredictionLayer: React.FC<Props> = ({ areas, visible, refreshKey }) => {
  const { t } = useTranslation();
  const [predictions, setPredictions] = useState<Record<number, FoxPrediction>>({});

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const load = async () => {
      // Fetch a prediction for every fox area, regardless of status — a fox in
      // cooldown ('inactive') can still have a fresh prediction worth showing.
      // The server-side anchor_source='none' filter (below) handles "no signal".
      const results = await Promise.all(
        areas.map((a) => gameService.getFoxPrediction(a.id).catch(() => null))
      );
      if (cancelled) return;
      const map: Record<number, FoxPrediction> = {};
      results.forEach((p) => {
        if (p && p.anchor_source !== 'none' && p.top_zones.length > 0) map[p.area_id] = p;
      });
      setPredictions(map);
    };

    load();
    const interval = setInterval(load, 30000); // keep fresh
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visible, areas, refreshKey]);

  if (!visible) return null;

  const areaName = (areaId: number) => areas.find((a) => a.id === areaId)?.name || `#${areaId}`;

  return (
    <>
      {Object.values(predictions).map((pred) => {
        const name = areaName(pred.area_id);
        const color = colorFor(name);

        // Downsample + threshold the heatmap points.
        const heat = pred.heatmap_geojson.features
          .filter((f) => f.properties.weight >= HEAT_MIN_WEIGHT)
          .sort((a, b) => b.properties.weight - a.properties.weight)
          .slice(0, MAX_HEAT_POINTS);

        return (
          <React.Fragment key={pred.area_id}>
            {/* Faint probability cloud */}
            {heat.map((f, i) => (
              <CircleMarker
                key={`${pred.area_id}-h-${i}`}
                center={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
                radius={7}
                pathOptions={{
                  color,
                  weight: 0,
                  fillColor: color,
                  fillOpacity: Math.min(0.45, 0.1 + f.properties.weight * 0.4),
                }}
                interactive={false}
              />
            ))}

            {/* Actionable top zones */}
            {pred.top_zones.map((z, i) => (
              <CircleMarker
                key={`${pred.area_id}-z-${i}`}
                center={[z.lat, z.lng]}
                radius={i === 0 ? 11 : 8}
                pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.55 }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  {name} · {z.label}
                </Tooltip>
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <strong>{name} — {z.label}</strong>
                    <div>{t('prediction.confidence')}: {Math.round(pred.confidence * 100)}% ({confidenceLabel(pred.confidence, t)})</div>
                    <div>{t('prediction.basedOn')}: {t(`prediction.source.${pred.anchor_source}`)}</div>
                    {pred.anchor_time && (
                      <div>{t('prediction.lastSignal')}: {new Date(pred.anchor_time).toLocaleTimeString()}</div>
                    )}
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                      {t('prediction.generated')}: {new Date(pred.generated_at).toLocaleTimeString()}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default FoxPredictionLayer;

"use client";
import { useCockpit } from "../../lib/store/cockpit-store";
import { utc } from "../../lib/replay";
import { Badge, PanelTitle } from "../ui";
export function OperatorComms() {
  return (
    <section className="panel">
      <PanelTitle
        icon="message"
        title="Operator comms"
        detail={<Badge source="no data" />}
      />
      <p className="kicker">PHOTON / READ-ONLY RECEIPTS</p>
      <p className="empty-state">
        No delivery or acknowledgement evidence attached.
      </p>
      <p className="subtle">
        Provider delivery and operator acknowledgement require separate
        receipts. No message is sent from this cockpit.
      </p>
    </section>
  );
}
export function SensorEvidence() {
  const r = useCockpit((s) => s.replay),
    cursor = useCockpit((s) => s.cursor);
  const sensor = r?.events.slice(0, cursor + 1).findLast((e) => e.sensor);
  return (
    <section className="panel">
      <PanelTitle
        icon="radio"
        title="Sensor evidence"
        detail={<span className="kicker">AS OF CURSOR</span>}
      />
      <dl className="sensor-values">
        <div>
          <dt>Pi CPU temperature</dt>
          <dd>
            <Badge source="no data" />
          </dd>
        </div>
        <div>
          <dt>DS18B20 ambient</dt>
          <dd>
            {sensor?.sensor?.ambient != null ? (
              <>
                {sensor.sensor.ambient} °C <Badge source={sensor.source} />
              </>
            ) : (
              <Badge source="no data" />
            )}
          </dd>
        </div>
        <div>
          <dt>ESP32 button</dt>
          <dd>
            <Badge
              source={sensor?.sensor?.button ? sensor.source : "no data"}
            />
          </dd>
        </div>
      </dl>
      <p className="subtle">
        {sensor
          ? `Historical frame · ${utc(sensor.at)} · ${sensor.sensor?.device}`
          : "No hardware frame as of cursor."}
      </p>
      <p className="subtle">
        Ambient temperature and CPU temperature are separate measurements.
      </p>
    </section>
  );
}
export function Readiness() {
  return (
    <section className="panel">
      <PanelTitle
        icon="radar"
        title="Lifeboat Score"
        detail={<Badge source="no data" />}
      />
      <div className="score">
        <span className="score-ring" aria-label="No live readiness score">
          —
        </span>
        <p>A replay has no live lease, standby or telemetry freshness.</p>
      </div>
      <details>
        <summary>How the live score would be weighted</summary>
        <p>
          Checkpoint freshness 35 · standby readiness 25 · telemetry freshness
          20 · lease health 10 · drill recency 10. <Badge source="no data" />
        </p>
        <p>These are policy weights, not a measured score.</p>
      </details>
    </section>
  );
}

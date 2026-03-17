import * as Cesium from 'cesium';
import { clearSatTrack, showSatTrack } from '../layers/satellites.js';

let selectedEntity = null;
let isTracking = false;
let activeViewer = null;

export function initEntityInteractions(viewer) {
  activeViewer = viewer;
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  const popup = document.getElementById('entityPopup');

  handler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    if (!Cesium.defined(picked) || !Cesium.defined(picked.id)) {
      hidePopup(viewer, popup);
      return;
    }

    selectedEntity = picked.id;
    renderPopup(viewer, popup, selectedEntity);

    if (isSatellite(selectedEntity)) {
      showSatTrack(selectedEntity);
      clearFlightPath();
    } else if (isFlight(selectedEntity)) {
      showFlightPath(selectedEntity);
      clearSatTrack();
    } else {
      clearSatTrack();
      clearFlightPath();
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  popup.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action || !selectedEntity) return;

    if (action.dataset.action === 'close') {
      hidePopup(viewer, popup);
      return;
    }

    if (action.dataset.action === 'track') {
      isTracking = !isTracking;
      viewer.trackedEntity = isTracking ? selectedEntity : undefined;
      renderPopup(viewer, popup, selectedEntity);
      return;
    }

    if (action.dataset.action === 'show-track') {
      if (viewer.entities.getById('st1')) clearSatTrack();
      else showSatTrack(selectedEntity);
      return;
    }

    if (action.dataset.action === 'show-flight') {
      if (viewer.entities.getById('fp1')) clearFlightPath();
      else showFlightPath(selectedEntity);
      return;
    }

    const position = selectedEntity.position?.getValue(viewer.clock.currentTime);
    if (!position) return;

    if (action.dataset.action === 'fly') {
      viewer.camera.flyTo({
        destination: position,
        duration: 1.3,
        offset: new Cesium.HeadingPitchRange(0, -0.75, 250000),
      });
    }
  });
}

function hidePopup(viewer, popup) {
  selectedEntity = null;
  isTracking = false;
  viewer.trackedEntity = undefined;
  popup.classList.add('hidden');
  popup.innerHTML = '';
  clearSatTrack();
  clearFlightPath();
}

function renderPopup(viewer, popup, entity) {
  const props = readProps(entity);
  const meta = getPopupMeta(entity, props);
  const rows = getFields(meta, props, entity, viewer);
  let extraButton = '';
  if (meta.kind === 'satellite') {
    extraButton = `<button class="popup-btn" data-action="show-track">${iconOrbit()} SHOW TRACK</button>`;
  } else if (meta.kind === 'aircraft') {
    extraButton = `<button class="popup-btn" data-action="show-flight">${iconOrbit()} SHOW PATH</button>`;
  }

  popup.innerHTML = `
    <div class="popup-header">
      <div class="popup-type-badge ${meta.badgeClass}">${meta.badgeText}</div>
      <div class="popup-title">${meta.title}</div>
      <button class="popup-close" data-action="close" aria-label="Close popup">&#10005;</button>
    </div>
    <div class="popup-divider"></div>
    <div class="popup-grid">${rows}</div>
    <div class="popup-actions">
      <button class="popup-btn primary" data-action="track">${iconTrack()} ${isTracking ? 'UNTRACK' : 'TRACK'}</button>
      <button class="popup-btn" data-action="fly">${iconFly()} FLY TO</button>
      ${extraButton}
    </div>
  `;

  popup.classList.remove('hidden');
}

function isSatellite(entity) {
  const type = readProperty(entity, 'type');
  return ['sats', 'iss', 'deb', 'star'].includes(String(type || '').toLowerCase());
}

function isFlight(entity) {
  const type = readProperty(entity, 'type');
  return ['comm', 'mil', 'heli', 'priv'].includes(String(type || '').toLowerCase());
}

function readProps(entity) {
  try {
    return entity.properties ? entity.properties.getValue(Cesium.JulianDate.now()) || {} : {};
  } catch {
    return {};
  }
}

function readProperty(entity, key) {
  const property = entity.properties?.[key];
  return property?.getValue ? property.getValue() : property ?? null;
}

function getPopupMeta(entity, props) {
  const shipType = props.shipType || '';
  const rawType = String(props.type || '').toLowerCase();
  const name = entity.name || props.callsign || props.name || 'UNKNOWN';

  if (isSatellite(entity)) {
    return { kind: 'satellite', badgeClass: 'satellite', badgeText: rawType === 'iss' ? 'ISS' : 'SAT', title: props.name || name };
  }
  if (shipType) {
    return { kind: 'ship', badgeClass: 'ship', badgeText: String(shipType || 'SHIP').toUpperCase().slice(0, 4), title: name };
  }
  if (rawType === 'mil') {
    return { kind: 'aircraft', badgeClass: 'military', badgeText: 'MIL', title: props.callsign || name };
  }
  return { kind: 'aircraft', badgeClass: 'aircraft', badgeText: rawType === 'heli' ? 'HELO' : rawType === 'priv' ? 'JET' : 'AIR', title: props.callsign || name };
}

function getFields(meta, props, entity, viewer) {
  const position = entity.position?.getValue(viewer.clock.currentTime);
  const cartographic = position ? Cesium.Cartographic.fromCartesian(position) : null;
  const lat = cartographic ? `${Cesium.Math.toDegrees(cartographic.latitude).toFixed(2)} deg` : '---';
  const lon = cartographic ? `${Cesium.Math.toDegrees(cartographic.longitude).toFixed(2)} deg` : '---';

  if (meta.kind === 'satellite') {
    return [
      field('NORAD', props.norad || readProperty(entity, 'norad') || '---'),
      field('INCL', valueOrDash(props.inclination, 'deg')),
      field('PERIOD', valueOrDash(props.period, 'min')),
      field('ALT', valueOrDash(props.altitudeKm || (cartographic ? cartographic.height / 1000 : null), 'km'), true),
      field('LAT', lat),
      field('LON', lon),
    ].join('');
  }

  if (meta.kind === 'ship') {
    return [
      field('CLASS', String(props.shipType || '---').toUpperCase()),
      field('MMSI', props.mmsi || '---'),
      field('HDG', valueOrDash(props.heading, 'deg')),
      field('SPD', valueOrDash(props.velocity || props.speed, 'kt')),
      field('LAT', lat),
      field('LON', lon),
    ].join('');
  }

  return [
    field('TYPE', String(props.type || 'AIR').toUpperCase()),
    field('ICAO', props.icao || '---'),
    field('ALT', valueOrDash(props.altitude || (cartographic ? cartographic.height : null), 'm'), true),
    field('SPD', valueOrDash(props.velocity, 'm/s')),
    field('LAT', lat),
    field('LON', lon),
  ].join('');
}

function valueOrDash(value, unit) {
  if (value === undefined || value === null || value === '') return '---';
  return `${Math.round(Number(value) * 100) / 100}${unit ? ` ${unit}` : ''}`;
}

function field(label, value, highlight = false) {
  return `
    <div class="popup-field">
      <span class="field-label">${label}</span>
      <span class="field-value${highlight ? ' highlight' : ''}">${value}</span>
    </div>
  `;
}

function iconTrack() {
  return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2"/></svg>';
}

function iconFly() {
  return '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M14 10.5v-1L9 7V2.5C9 1.67 8.33 1 7.5 1S6 1.67 6 2.5V7L1 9.5v1L6 9v4l-1.5 1V15l3-1 3 1v-1L9 13V9z"/></svg>';
}

function iconOrbit() {
  return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="8" cy="8" rx="6" ry="3.2"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/></svg>';
}

function clearFlightPath() {
  ['fp1', 'fp2'].forEach((id) => {
    const entity = window.viewer?.entities.getById(id);
    if (entity) {
      window.viewer.entities.remove(entity);
    }
  });
}

function showFlightPath(entity) {
  clearFlightPath();

  const data = entity?.properties?.data?.getValue
    ? entity.properties.data.getValue(Cesium.JulianDate.now())
    : null;
  if (!data || !window.viewer) return;

  const lat = data.lat ?? data[6];
  const lon = data.lon ?? data[5];
  const speed = data.velocity ?? data[9] ?? 220;
  const heading = (data.true_track ?? data[10] ?? 0) * Math.PI / 180;
  const altitude = data.baro_altitude ?? data[7] ?? 10000;
  const R = 6371000;
  const angularDistance = (speed * 60) / R;
  let currentLat = lat * Math.PI / 180;
  let currentLon = lon * Math.PI / 180;
  const pts = [];

  for (let i = 0; i < 60; i += 1) {
    pts.push(Cesium.Cartesian3.fromDegrees(currentLon * 180 / Math.PI, currentLat * 180 / Math.PI, altitude));

    const nextLat = Math.asin(
      Math.sin(currentLat) * Math.cos(angularDistance) +
      Math.cos(currentLat) * Math.sin(angularDistance) * Math.cos(heading),
    );
    const nextLon = currentLon + Math.atan2(
      Math.sin(heading) * Math.sin(angularDistance) * Math.cos(currentLat),
      Math.cos(angularDistance) - Math.sin(currentLat) * Math.sin(nextLat),
    );
    currentLat = nextLat;
    currentLon = nextLon;
  }

  window.viewer.entities.add({
    id: 'fp1',
    polyline: {
      positions: pts,
      width: 1.5,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.WHITE.withAlpha(0.45),
        dashLength: 10,
      }),
    },
  });

  window.viewer.entities.add({
    id: 'fp2',
    position: pts[pts.length - 1],
    point: {
      pixelSize: 7,
      color: Cesium.Color.fromCssColorString('#ffaa00'),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 1,
    },
  });
}

import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';

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
      showSatelliteTrack(selectedEntity);
      removeFlightPath();
    } else if (isFlight(selectedEntity)) {
      showFlightPath(selectedEntity);
      removeSatelliteTrack();
    } else {
      removeSatelliteTrack();
      removeFlightPath();
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
      if (viewer.entities.getById('__sat_track__')) removeSatelliteTrack();
      else showSatelliteTrack(selectedEntity);
      return;
    }

    if (action.dataset.action === 'show-flight') {
      if (viewer.entities.getById('__flight_path__')) removeFlightPath();
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
  removeSatelliteTrack();
  removeFlightPath();
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

function showSatelliteTrack(entity) {
  removeSatelliteTrack();

  const satrec = entity.properties?.satrec?.getValue
    ? entity.properties.satrec.getValue()
    : entity.worldview?.satrec;
  if (!satrec || !activeViewer) return;

  const now = new Date();
  const trackPositions = [];
  const groundPositions = [];

  for (let i = 0; i <= 180; i += 1) {
    const time = new Date(now.getTime() + i * 30 * 1000);
    try {
      const posVel = satellite.propagate(satrec, time);
      if (!posVel || !posVel.position || typeof posVel.position === 'boolean') continue;
      const gmst = satellite.gstime(time);
      const geo = satellite.eciToGeodetic(posVel.position, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lon = satellite.degreesLong(geo.longitude);
      const alt = geo.height * 1000;
      trackPositions.push(Cesium.Cartesian3.fromDegrees(lon, lat, alt));
      groundPositions.push(Cesium.Cartesian3.fromDegrees(lon, lat, 0));
    } catch {
      continue;
    }
  }

  activeViewer.entities.add({
    id: '__sat_track__',
    polyline: {
      positions: trackPositions,
      width: 1.5,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.fromCssColorString('#00ffff').withAlpha(0.7),
        dashLength: 16,
        dashPattern: 0xFF00,
      }),
      clampToGround: false,
    },
  });

  activeViewer.entities.add({
    id: '__sat_ground__',
    polyline: {
      positions: groundPositions,
      width: 1,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.fromCssColorString('#00ff88').withAlpha(0.35),
        dashLength: 8,
      }),
      clampToGround: true,
    },
  });

  const posVel = satellite.propagate(satrec, now);
  if (!posVel || !posVel.position || typeof posVel.position === 'boolean') return;
  const gmst = satellite.gstime(now);
  const geo = satellite.eciToGeodetic(posVel.position, gmst);
  const firstGeo = {
    lat: satellite.degreesLat(geo.latitude),
    lon: satellite.degreesLong(geo.longitude),
  };
  const currentPosition = entity.position?.getValue(Cesium.JulianDate.now());
  if (!currentPosition) return;

  activeViewer.entities.add({
    id: '__sat_nadir__',
    polyline: {
      positions: [
        currentPosition,
        Cesium.Cartesian3.fromDegrees(firstGeo.lon, firstGeo.lat, 0),
      ],
      width: 1,
      material: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.2),
    },
  });

  activeViewer.entities.add({
    id: '__sat_look__',
    position: Cesium.Cartesian3.fromDegrees(firstGeo.lon, firstGeo.lat, 100),
    ellipse: {
      semiMajorAxis: 120000,
      semiMinorAxis: 120000,
      material: Cesium.Color.fromCssColorString('#00ffff').withAlpha(0.15),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('#00ffff').withAlpha(0.6),
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
  });
}

function removeSatelliteTrack() {
  ['__sat_track__', '__sat_ground__', '__sat_nadir__', '__sat_look__'].forEach((id) => {
    const entity = activeViewer?.entities.getById(id);
    if (entity) activeViewer.entities.remove(entity);
  });
}

function showFlightPath(entity) {
  removeFlightPath();
  const data = entity.properties?.data?.getValue
    ? entity.properties.data.getValue()
    : entity.worldview?.data;
  if (!data || !activeViewer) return;

  const lat = data.lat;
  const lon = data.lon;
  const heading = data.track || 0;
  const speed = data.velocity || 250;
  const positions = [];
  const earthRadius = 6371000;
  let curLat = lat * Math.PI / 180;
  let curLon = lon * Math.PI / 180;
  const hdg = heading * Math.PI / 180;
  const distPerStep = speed * 60;
  const d = distPerStep / earthRadius;

  for (let i = 0; i <= 60; i += 1) {
    const newLat = Math.asin(
      Math.sin(curLat) * Math.cos(d) +
      Math.cos(curLat) * Math.sin(d) * Math.cos(hdg),
    );
    const newLon = curLon + Math.atan2(
      Math.sin(hdg) * Math.sin(d) * Math.cos(curLat),
      Math.cos(d) - Math.sin(curLat) * Math.sin(newLat),
    );
    const alt = data.baro_altitude || 10000;
    positions.push(
      Cesium.Cartesian3.fromDegrees(
        newLon * 180 / Math.PI,
        newLat * 180 / Math.PI,
        alt,
      ),
    );
    curLat = newLat;
    curLon = newLon;
  }

  activeViewer.entities.add({
    id: '__flight_path__',
    polyline: {
      positions,
      width: 1.5,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.5),
        dashLength: 12,
      }),
    },
  });

  activeViewer.entities.add({
    id: '__flight_end__',
    position: positions[positions.length - 1],
    point: {
      pixelSize: 8,
      color: Cesium.Color.fromCssColorString('#ffaa00').withAlpha(0.8),
      outlineColor: Cesium.Color.WHITE.withAlpha(0.4),
      outlineWidth: 1,
    },
  });
}

function removeFlightPath() {
  ['__flight_path__', '__flight_end__'].forEach((id) => {
    const entity = activeViewer?.entities.getById(id);
    if (entity) activeViewer.entities.remove(entity);
  });
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

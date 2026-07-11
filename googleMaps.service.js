const axios = require('axios');

const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api';

function apiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY is not set in the environment.');
  return key;
}

/**
 * Turns a free-text address into { lat, lng, formattedAddress }.
 * Called once when a shop saves/updates an Address, so we store coordinates
 * instead of re-geocoding on every order.
 */
async function geocodeAddress(addressString) {
  const { data } = await axios.get(`${GOOGLE_BASE}/geocode/json`, {
    params: { address: addressString, key: apiKey() },
  });

  if (data.status !== 'OK' || !data.results.length) {
    throw new Error(`Geocoding failed: ${data.status}`);
  }

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

/**
 * Directions between the dispatch warehouse and the shop's delivery address.
 * Returns distance, duration, and an encoded polyline the client can render
 * directly on a Google Map (or hand to the Directions Renderer).
 */
async function getRoute({ originLat, originLng, destLat, destLng }) {
  const { data } = await axios.get(`${GOOGLE_BASE}/directions/json`, {
    params: {
      origin: `${originLat},${originLng}`,
      destination: `${destLat},${destLng}`,
      mode: 'driving',
      key: apiKey(),
    },
  });

  if (data.status !== 'OK' || !data.routes.length) {
    throw new Error(`Directions request failed: ${data.status}`);
  }

  const route = data.routes[0];
  const leg = route.legs[0];

  return {
    distanceMeters: leg.distance.value,
    durationSeconds: leg.duration.value,
    polyline: route.overview_polyline.points,
    startAddress: leg.start_address,
    endAddress: leg.end_address,
  };
}

/**
 * Live ETA recompute — call this whenever the delivery partner's location
 * updates (see sockets/trackingSocket.js). Distance Matrix is cheaper than
 * re-requesting full Directions on every ping.
 */
async function getLiveEta({ originLat, originLng, destLat, destLng }) {
  const { data } = await axios.get(`${GOOGLE_BASE}/distancematrix/json`, {
    params: {
      origins: `${originLat},${originLng}`,
      destinations: `${destLat},${destLng}`,
      mode: 'driving',
      departure_time: 'now', // uses live traffic when billing account supports it
      key: apiKey(),
    },
  });

  const element = data?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error(`Distance Matrix request failed: ${element?.status || data.status}`);
  }

  const durationSeconds = (element.duration_in_traffic || element.duration).value;
  return {
    minutesRemaining: Math.round(durationSeconds / 60),
    distanceMeters: element.distance.value,
  };
}

/** One-tap turn-by-turn navigation link for the delivery partner's app / SMS. */
function buildNavigationUrl({ destLat, destLng, originLat, originLng }) {
  const base = 'https://www.google.com/maps/dir/?api=1';
  const origin = originLat && originLng ? `&origin=${originLat},${originLng}` : '';
  return `${base}${origin}&destination=${destLat},${destLng}&travelmode=driving`;
}

module.exports = {
  geocodeAddress,
  getRoute,
  getLiveEta,
  buildNavigationUrl,
};

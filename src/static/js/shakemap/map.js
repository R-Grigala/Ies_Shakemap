/**
 * ShakeMap Leaflet map — products resolved per event via API:
 *   /api/shakemap/<seiscomp_oid>/product/<filename>
 *
 * Server files live under:
 *   {SHAKEMAP_BASE_PATH}/<seiscomp_oid>/current/products/
 */

const ShakeMap = window.ShakeMap || {
  map: null,
  basemapLayers: {},
  currentLayers: {},
  activeBasemap: "street",
};
window.ShakeMap = ShakeMap;

/** USGS MMI color ramp (index ~ intensity 0–10) */
const intColors_USGS = [
  "#FFFFFF",
  "#FFFFFF",
  "#B0E0FF",
  "#6EC0FF",
  "#00FF00",
  "#FFFF00",
  "#FFC800",
  "#FF7F00",
  "#FF0000",
  "#C00000",
  "#800080",
];

function formatUnit(unit) {
  if (!unit) {
    return "";
  }
  const value = String(unit).trim();
  if (!value || value.toLowerCase() === "mmi") {
    return "";
  }
  return value;
}

/**
 * Product URL for a specific SeisComP event.
 * @param {string} seiscompOid
 * @param {string} filename e.g. cont_pga.json, stationlist.json
 */
function getShakemapProductUrl(seiscompOid, filename) {
  const oid = encodeURIComponent(seiscompOid);
  const file = encodeURIComponent(filename);
  return `/api/shakemap/${oid}/product/${file}`;
}

function resolveEventCoords(event) {
  const lat = parseFloat(event.lat ?? event.latitude);
  const lon = parseFloat(event.lon ?? event.longitude);
  return { lat, lon };
}

function resolveSeiscompOid(event) {
  return String(event.seiscomp_oid || event.id || "").trim();
}

/**
 * Initialize the ShakeMap Leaflet map for an event.
 * @param {Object} event - { seiscomp_oid, latitude|lat, longitude|lon }
 * @param {Object} options
 */
async function initShakeMapMap(event, options = {}) {
  const mapEl = document.getElementById(options.mapElementId || "shakemap-map");
  const layerList = document.getElementById(options.layerListId || "layer-list");
  if (!mapEl || typeof L === "undefined") {
    console.warn("ShakeMap map: Leaflet container or L is missing");
    return;
  }

  const seiscompOid = resolveSeiscompOid(event);
  const { lat, lon } = resolveEventCoords(event);
  if (!seiscompOid || Number.isNaN(lat) || Number.isNaN(lon)) {
    if (layerList) {
      layerList.innerHTML =
        '<div class="text-muted small">Event coordinates or SeisComP OID missing.</div>';
    }
    return;
  }

  const productUrl = (filename) => getShakemapProductUrl(seiscompOid, filename);
  const selectedBasemap = ShakeMap.activeBasemap || "street";

  if (ShakeMap.map) {
    ShakeMap.map.remove();
    ShakeMap.map = null;
  }

  let bounds = [
    [lat - 0.5, lon - 0.5],
    [lat + 0.5, lon + 0.5],
  ];

  try {
    const infoRes = await fetch(productUrl("info.json"));
    if (infoRes.ok) {
      const info = await infoRes.json();
      const mapInfo = info?.output?.map_information;
      if (mapInfo?.min && mapInfo?.max) {
        const minLat = parseFloat(mapInfo.min.latitude);
        const minLon = parseFloat(mapInfo.min.longitude);
        const maxLat = parseFloat(mapInfo.max.latitude);
        const maxLon = parseFloat(mapInfo.max.longitude);
        if (![minLat, minLon, maxLat, maxLon].some(Number.isNaN)) {
          bounds = [
            [minLat, minLon],
            [maxLat, maxLon],
          ];
        }
      }
    }
  } catch (e) {
    console.warn("Could not load info.json for bounds", e);
  }

  ShakeMap.map = L.map(mapEl).fitBounds(bounds);

  ShakeMap.basemapLayers = {
    street: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }),
    satellite: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
      }
    ),
  };

  if (ShakeMap.basemapLayers[selectedBasemap]) {
    ShakeMap.basemapLayers[selectedBasemap].addTo(ShakeMap.map);
  } else {
    ShakeMap.basemapLayers.street.addTo(ShakeMap.map);
    ShakeMap.activeBasemap = "street";
  }

  const epicenterIcon = L.divIcon({
    className: "epicenter-marker",
    html: `<div class="epicenter-container">
                <div class="epicenter-pulse"></div>
                <div class="epicenter-pulse pulse-2"></div>
                <div class="epicenter-star" aria-hidden="true">★</div>
              </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  L.marker([lat, lon], { icon: epicenterIcon }).addTo(ShakeMap.map).bindPopup("Epicenter");

  if (layerList) {
    layerList.innerHTML = "";
  }
  ShakeMap.currentLayers = {};

  if (layerList) {
    const basemapDiv = document.createElement("div");
    basemapDiv.className = "shakemap-layer-group";
    basemapDiv.innerHTML = `
        <label class="d-block mb-2">
            <input type="radio" name="basemap" value="street" ${
              selectedBasemap === "street" ? "checked" : ""
            } onchange="switchBasemap('street')">
            Street
        </label>
        <label class="d-block mb-2">
            <input type="radio" name="basemap" value="satellite" ${
              selectedBasemap === "satellite" ? "checked" : ""
            } onchange="switchBasemap('satellite')">
            Satellite
        </label>
    `;
    layerList.appendChild(basemapDiv);

    const separator = document.createElement("hr");
    separator.className = "my-3";
    layerList.appendChild(separator);
  }

  const DATA_LAYER_GROUP = "datalayer";
  const dataLayers = [
    { name: "Intensity", file: "cont_mi.json", color: "#ff0000" },
    { name: "PGA", file: "cont_pga.json", color: "#0000ff" },
    { name: "PGV", file: "cont_pgv.json", color: "#008000" },
    { name: "PSA 0.3s", file: "cont_psa0p3.json", color: "#ffa500" },
    { name: "PSA 1.0s", file: "cont_psa1p0.json", color: "#800080" },
    { name: "PSA 3.0s", file: "cont_psa3p0.json", color: "#a52a2a" },
  ];

  const addLayer = async (name, filename, color, inputType = "checkbox", groupName = null, checked = false) => {
    try {
      const res = await fetch(productUrl(filename));
      if (!res.ok) {
        return;
      }
      const geojson = await res.json();

      const layer = L.geoJSON(geojson, {
        style: function (feature) {
          return {
            color: feature.properties?.color || color,
            weight: feature.properties?.weight || 2,
            opacity: 1,
          };
        },
        onEachFeature: function (feature, featureLayer) {
          if (feature.properties && feature.properties.value != null) {
            let label = name;
            let val = feature.properties.value;
            let unit = formatUnit(feature.properties.units || "");

            if (name.includes("Intensity")) {
              label = "Intensity";
              if (unit.toLowerCase() === "mmi") {
                unit = "";
              }
            }

            featureLayer.bindPopup(`${label}: ${val} ${unit}`.trim());
          }
        },
      });

      if (checked) {
        layer.addTo(ShakeMap.map);
      }
      ShakeMap.currentLayers[name] = layer;

      if (!layerList) {
        return;
      }

      const div = document.createElement("div");
      const onChangeCall =
        inputType === "radio" ? `switchDataLayer('${name}')` : `toggleLayer('${name}')`;

      div.innerHTML = `
                <label>
                    <input type="${inputType}" ${groupName ? `name="${groupName}"` : ""} ${
        checked ? "checked" : ""
      } onchange="${onChangeCall}">
                    ${name}
                </label>
            `;
      layerList.appendChild(div);
    } catch (e) {
      console.warn(`Failed to load layer ${name}`, e);
    }
  };

  for (let i = 0; i < dataLayers.length; i++) {
    const item = dataLayers[i];
    await addLayer(item.name, item.file, item.color, "radio", DATA_LAYER_GROUP, i === 0);
  }

  if (layerList) {
    const separator2 = document.createElement("hr");
    separator2.className = "my-3";
    layerList.appendChild(separator2);
  }

  try {
    const res = await fetch(productUrl("stationlist.json"));
    if (res.ok) {
      const geojson = await res.json();

      const macroseismicLayer = L.geoJSON(geojson, {
        filter: function (feature) {
          return feature.properties?.station_type === "macroseismic";
        },
        pointToLayer: function (feature, latlng) {
          const stationColorIndex = Math.round(feature.properties.intensity);
          const color = intColors_USGS[stationColorIndex] || "black";
          return L.circleMarker(latlng, {
            radius: 4,
            fillColor: color,
            color: "black",
            weight: 1,
            opacity: 1,
            fillOpacity: 1,
          });
        },
        onEachFeature: function (feature, featureLayer) {
          bindStationPopup(feature, featureLayer);
        },
      });

      ShakeMap.currentLayers.Macroseismic = macroseismicLayer;
      if (layerList && macroseismicLayer.getLayers().length > 0) {
        const autoEnable = options.enableMacroseismic === true;
        if (autoEnable) {
          macroseismicLayer.addTo(ShakeMap.map);
        }
        const div = document.createElement("div");
        div.innerHTML = `
                    <label>
                        <input type="checkbox" ${
                          autoEnable ? "checked" : ""
                        } onchange="toggleLayer('Macroseismic')">
                        Show Reported Intensity
                    </label>
                `;
        layerList.appendChild(div);
      }

      const seismicLayer = L.geoJSON(geojson, {
        filter: function (feature) {
          return feature.properties?.station_type !== "macroseismic";
        },
        pointToLayer: function (feature, latlng) {
          let stationColorIndex = 1;
          let useComplexLogic = false;

          if (feature.properties.mmi_from_pgm && Array.isArray(feature.properties.mmi_from_pgm)) {
            try {
              if (feature.properties.intensity < 5) {
                const result = feature.properties.mmi_from_pgm.find((obj) => obj.name === "pga");
                if (result) {
                  stationColorIndex = Math.round(result.value);
                  useComplexLogic = true;
                }
              } else {
                const result = feature.properties.mmi_from_pgm.find((obj) => obj.name === "pgv");
                if (result) {
                  stationColorIndex = Math.round(result.value);
                  useComplexLogic = true;
                }
              }
            } catch (err) {
              console.warn("Error in station color logic", err);
            }
          }

          if (!useComplexLogic) {
            stationColorIndex = Math.round(feature.properties.intensity || 1);
          }

          const fillColor = intColors_USGS[stationColorIndex] || "#FFFFFF";
          const triangleIcon = L.divIcon({
            className: "triangle-marker",
            html: `<svg width="14" height="12" viewBox="0 0 14 12" xmlns="http://www.w3.org/2000/svg"
                            style="display: block; overflow: visible; pointer-events: none;" aria-hidden="true">
                            <polygon points="7,0 14,12 0,12" fill="#000" style="pointer-events: none;" />
                            <polygon points="7,2 13,12 1,12" fill="${fillColor}" style="pointer-events: none;" />
                        </svg>`,
            iconSize: [14, 12],
            iconAnchor: [7, 12],
          });

          return L.marker(latlng, { icon: triangleIcon });
        },
        onEachFeature: function (feature, featureLayer) {
          bindStationPopup(feature, featureLayer);
        },
      });

      ShakeMap.currentLayers.Stations = seismicLayer;
      if (layerList) {
        const divSt = document.createElement("div");
        divSt.innerHTML = `
                    <label>
                        <input type="checkbox" onchange="toggleLayer('Stations')">
                        Show Stations
                    </label>
                `;
        layerList.appendChild(divSt);
      }
    }
  } catch (e) {
    console.warn("Failed to load stations", e);
  }

  try {
    const ruptureRes = await fetch(productUrl("rupture.json"));
    if (ruptureRes.ok) {
      const ruptureJson = await ruptureRes.json();
      let isValidFault = false;
      if (ruptureJson.features && ruptureJson.features.length > 0) {
        const geometry = ruptureJson.features[0].geometry;
        if (geometry && geometry.coordinates && Array.isArray(geometry.coordinates)) {
          if (Array.isArray(geometry.coordinates[0])) {
            isValidFault = true;
          }
        }
      }

      if (isValidFault) {
        const ruptureLayer = L.geoJSON(ruptureJson, {
          style: { color: "black", weight: 3, opacity: 1 },
        });
        ShakeMap.currentLayers.Fault = ruptureLayer;
        if (layerList) {
          const divFault = document.createElement("div");
          divFault.innerHTML = `
                    <label>
                        <input type="checkbox" onchange="toggleLayer('Fault')">
                        Show fault
                    </label>
                `;
          layerList.appendChild(divFault);
        }
      }
    }
  } catch (e) {
    console.warn("Failed to load rupture.json", e);
  }

  let legendExists = false;
  try {
    const legendRes = await fetch(productUrl("mmi_legend.png"), { method: "HEAD" });
    if (legendRes.ok) {
      L.Control.Legend = L.Control.extend({
        onAdd: function () {
          const div = L.DomUtil.create("div", "legend-control");
          div.innerHTML = `<img src="${productUrl(
            "mmi_legend.png"
          )}" alt="MMI Legend" class="shakemap-legend-img">`;
          return div;
        },
      });
      L.control.legend = function (opts) {
        return new L.Control.Legend(opts);
      };
      const legendControl = L.control.legend({ position: "bottomleft" });
      legendControl.addTo(ShakeMap.map);
      ShakeMap.currentLayers.Legend = legendControl;
      legendExists = true;
    }
  } catch (e) {
    console.warn("Failed to load legend", e);
  }

  if (layerList) {
    const div = document.createElement("div");
    div.innerHTML = `
        <label>
            <input type="checkbox" ${legendExists ? "checked" : ""} onchange="toggleLayer('Legend')">
            Show Legend
        </label>
    `;
    layerList.appendChild(div);
  }

  // leaflet needs invalidateSize when shown in a hidden tab
  setTimeout(() => {
    if (ShakeMap.map) {
      ShakeMap.map.invalidateSize();
    }
  }, 100);
}

function bindStationPopup(feature, layer) {
  if (!feature.properties) {
    return;
  }
  const props = feature.properties;
  const code = props.code || props.id || "Unknown";
  const network = props.network || props.name?.split(".")[0] || "N/A";
  const stationName = code.includes(".") ? code.split(".").slice(1).join(".") : code;

  const formatNumber = (val, decimals) => {
    return val !== null && val !== undefined && !Number.isNaN(Number(val))
      ? Number(val).toFixed(decimals)
      : "N/A";
  };

  layer.bindPopup(`
            <div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6;">
                <strong>Station:</strong> ${stationName}<br>
                <strong>Network:</strong> ${network}<br>
                <strong>Type:</strong> ${props.station_type || "N/A"}<br>
                <strong>Distance:</strong> ${formatNumber(props.distance, 3)} km<br>
                <strong>Intensity:</strong> ${formatNumber(props.intensity, 1)}<br>
                <strong>PGA:</strong> ${formatNumber(props.pga, 4)}<br>
                <strong>PGV:</strong> ${formatNumber(props.pgv, 4)}<br>
                <strong>Vs30:</strong> ${
                  props.vs30 && !Number.isNaN(Number(props.vs30)) ? Math.round(props.vs30) : "N/A"
                } m/s
            </div>
        `);
}

window.switchDataLayer = function (selectedName) {
  const dataKeys = ["Intensity", "PGA", "PGV", "PSA 0.3s", "PSA 1.0s", "PSA 3.0s"];
  dataKeys.forEach((name) => {
    if (!ShakeMap.currentLayers[name] || !ShakeMap.map) {
      return;
    }
    if (name === selectedName) {
      if (!ShakeMap.map.hasLayer(ShakeMap.currentLayers[name])) {
        ShakeMap.map.addLayer(ShakeMap.currentLayers[name]);
      }
    } else if (ShakeMap.map.hasLayer(ShakeMap.currentLayers[name])) {
      ShakeMap.map.removeLayer(ShakeMap.currentLayers[name]);
    }
  });
};

window.toggleLayer = function (name) {
  if (!ShakeMap.currentLayers[name] || !ShakeMap.map) {
    return;
  }
  if (ShakeMap.currentLayers[name] instanceof L.Control) {
    const container = ShakeMap.currentLayers[name].getContainer();
    if (container && container.parentNode) {
      ShakeMap.map.removeControl(ShakeMap.currentLayers[name]);
    } else {
      ShakeMap.currentLayers[name].addTo(ShakeMap.map);
    }
  } else if (ShakeMap.map.hasLayer(ShakeMap.currentLayers[name])) {
    ShakeMap.map.removeLayer(ShakeMap.currentLayers[name]);
  } else {
    ShakeMap.map.addLayer(ShakeMap.currentLayers[name]);
  }
};

window.switchBasemap = function (basemapType) {
  ShakeMap.activeBasemap = basemapType;
  if (!ShakeMap.map || !ShakeMap.basemapLayers) {
    return;
  }
  Object.values(ShakeMap.basemapLayers).forEach((layer) => {
    if (ShakeMap.map.hasLayer(layer)) {
      ShakeMap.map.removeLayer(layer);
    }
  });
  if (ShakeMap.basemapLayers[basemapType]) {
    ShakeMap.basemapLayers[basemapType].addTo(ShakeMap.map);
  }
};

// Prefer project name; keep initMap alias for older call sites.
window.initShakeMapMap = initShakeMapMap;
window.initMap = initShakeMapMap;
window.getShakemapProductUrl = getShakemapProductUrl;
window.bindStationPopup = bindStationPopup;

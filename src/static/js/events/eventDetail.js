/**
 * Event detail page:
 * - list helpers (view button / id link by seiscomp_oid)
 * - Static View (INTENSITY / PGA / PGV / PSA 0.3s / 1.0s / 3.0s) for /events/<seiscomp_oid>
 */

const SHAKEMAP_STATIC_IMAGE_ORDER = ["intensity", "pga", "pgv", "psa0p3", "psa1p0", "psa3p0"];
const SHAKEMAP_STATIC_IMAGE_LABELS = {
  intensity: "INTENSITY",
  pga: "PGA",
  pgv: "PGV",
  psa0p3: "PSA 0.3s",
  psa1p0: "PSA 1.0s",
  psa3p0: "PSA 3.0s",
};

/** @type {Record<string, { type: string, filename: string, exists: boolean, url: string }>|null} */
let shakemapImagesByType = null;
let activeShakemapType = "intensity";

function getEventDetailUrl(seiscompOid) {
  return `/events/${encodeURIComponent(seiscompOid)}`;
}

function buildViewEventButton(seiscompOid) {
  if (seiscompOid === undefined || seiscompOid === null || seiscompOid === "") {
    return "";
  }
  const url = getEventDetailUrl(seiscompOid);
  return `
    <a
      href="${url}"
      class="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center"
      title="View event details"
      aria-label="View event details"
    >
      <img
        src="/static/img/eye-view.svg"
        alt="View"
        style="width: 14px; height: 14px;"
      >
    </a>
  `;
}

function buildEventIdLink(seiscompOid, label) {
  if (seiscompOid === undefined || seiscompOid === null || seiscompOid === "") {
    return eventDetailEscapeHtml(label ?? "-");
  }
  return `
    <a href="${getEventDetailUrl(seiscompOid)}" class="text-decoration-none">
      ${eventDetailEscapeHtml(label ?? "-")}
    </a>
  `;
}

function eventDetailEscapeHtml(value) {
  if (typeof window.escapeHtml === "function") {
    return window.escapeHtml(value);
  }
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function getShakemapImageUrl(seiscompOid, imageType) {
  return `/api/shakemap/${encodeURIComponent(seiscompOid)}/image/${encodeURIComponent(imageType)}`;
}

function normalizeShakemapImages(seiscompOid, payloadImages) {
  const byType = {};
  if (Array.isArray(payloadImages)) {
    payloadImages.forEach((image) => {
      if (image && image.type) {
        byType[image.type] = image;
      }
    });
  }

  const result = {};
  SHAKEMAP_STATIC_IMAGE_ORDER.forEach((type) => {
    const existing = byType[type];
    if (existing) {
      result[type] = {
        type,
        filename: existing.filename || `${type}.jpg`,
        exists: Boolean(existing.exists),
        url: existing.url || getShakemapImageUrl(seiscompOid, type),
      };
    } else {
      result[type] = {
        type,
        filename: `${type}.jpg`,
        exists: false,
        url: getShakemapImageUrl(seiscompOid, type),
      };
    }
  });
  return result;
}

function probeImageUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function probeAndUpgradeImages(imagesByType) {
  const entries = Object.values(imagesByType);
  await Promise.all(
    entries.map(async (image) => {
      if (!image.exists) {
        image.exists = await probeImageUrl(image.url);
      }
    })
  );
  return imagesByType;
}

function setActiveTypeButton(imageType) {
  const toolbar = document.getElementById("shakemapTypeToolbar");
  if (!toolbar) {
    return;
  }
  toolbar.querySelectorAll(".static-view-btn").forEach((btn) => {
    const isActive = btn.dataset.imageType === imageType;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function showShakemapType(imageType) {
  activeShakemapType = imageType;
  setActiveTypeButton(imageType);

  const statusEl = document.getElementById("shakemapImagesStatus");
  const linkEl = document.getElementById("shakemapStaticImageLink");
  const imgEl = document.getElementById("shakemapStaticImage");
  const emptyEl = document.getElementById("shakemapStaticEmpty");

  if (!statusEl || !linkEl || !imgEl || !emptyEl) {
    return;
  }

  const label = SHAKEMAP_STATIC_IMAGE_LABELS[imageType] || String(imageType).toUpperCase();
  const image = shakemapImagesByType ? shakemapImagesByType[imageType] : null;

  if (!image || !image.exists) {
    linkEl.classList.add("d-none");
    imgEl.removeAttribute("src");
    emptyEl.classList.remove("d-none");
    emptyEl.textContent = image
      ? `${label} product is not available for this event.`
      : `${label} product is not loaded.`;
    statusEl.textContent = image?.filename
      ? `${label}: ${image.filename} missing`
      : `${label}: not available`;
    return;
  }

  emptyEl.classList.add("d-none");
  linkEl.classList.remove("d-none");
  linkEl.href = image.url;
  imgEl.src = image.url;
  imgEl.alt = `${label} ShakeMap`;
  statusEl.textContent = `${label} · ${image.filename}`;
}

function bindShakemapTypeToolbar() {
  const toolbar = document.getElementById("shakemapTypeToolbar");
  if (!toolbar) {
    return;
  }
  toolbar.querySelectorAll(".static-view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.imageType;
      if (type) {
        showShakemapType(type);
      }
    });
  });
}

/**
 * Loads product catalog and shows the active static map type.
 */
async function loadShakemapStaticView() {
  const root = document.getElementById("shakemapStaticView");
  if (!root) {
    return;
  }

  const statusEl = document.getElementById("shakemapImagesStatus");
  const seiscompOid = (root.dataset.seiscompOid || "").trim();

  if (!statusEl) {
    return;
  }

  if (!seiscompOid) {
    statusEl.textContent = "SeisComP OID is missing; cannot load ShakeMap products.";
    return;
  }

  statusEl.textContent = "Loading ShakeMap products...";
  bindShakemapTypeToolbar();

  try {
    const response = await fetch(`/api/shakemap/${encodeURIComponent(seiscompOid)}`, {
      method: "GET",
      headers: { accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));

    shakemapImagesByType = normalizeShakemapImages(seiscompOid, payload.images);

    if (!response.ok) {
      await probeAndUpgradeImages(shakemapImagesByType);
      statusEl.textContent =
        payload.error ||
        "ShakeMap job not found. Images shown only if product files already exist.";
    } else {
      const availableCount = Object.values(shakemapImagesByType).filter((i) => i.exists).length;
      if (availableCount === 0) {
        statusEl.textContent = "No ShakeMap product images found yet for this event.";
      }
    }

    // Prefer first available type in order intensity → pga → pgv
    const preferred =
      SHAKEMAP_STATIC_IMAGE_ORDER.find(
        (type) => shakemapImagesByType[type] && shakemapImagesByType[type].exists
      ) || activeShakemapType;

    showShakemapType(preferred);
  } catch {
    statusEl.textContent = "Request failed while loading ShakeMap products.";
    shakemapImagesByType = null;
  }
}

window.getEventDetailUrl = getEventDetailUrl;
window.buildViewEventButton = buildViewEventButton;
window.buildEventIdLink = buildEventIdLink;
window.loadShakemapStaticView = loadShakemapStaticView;
window.showShakemapType = showShakemapType;

let eventDetailMapInitialized = false;

function getDetailMapEventPayload() {
  const panel = document.getElementById("panel-map-view");
  if (!panel) {
    return null;
  }
  return {
    seiscomp_oid: panel.dataset.seiscompOid || "",
    latitude: panel.dataset.lat,
    longitude: panel.dataset.lon,
  };
}

async function initEventDetailMap(force = false) {
  if (eventDetailMapInitialized && !force) {
    if (window.ShakeMap && window.ShakeMap.map) {
      window.ShakeMap.map.invalidateSize();
    }
    return;
  }
  if (typeof window.initShakeMapMap !== "function" && typeof window.initMap !== "function") {
    return;
  }
  if (typeof L === "undefined") {
    return;
  }

  const eventPayload = getDetailMapEventPayload();
  if (!eventPayload || !eventPayload.seiscomp_oid) {
    const layerList = document.getElementById("layer-list");
    if (layerList) {
      layerList.innerHTML = '<div class="text-muted small">SeisComP OID missing for map.</div>';
    }
    return;
  }

  const initFn = window.initShakeMapMap || window.initMap;
  await initFn(eventPayload);
  eventDetailMapInitialized = true;
}

function bindEventDetailMapTab() {
  const mapTab = document.getElementById("tab-map-view");
  if (!mapTab) {
    return;
  }
  mapTab.addEventListener("shown.bs.tab", () => {
    initEventDetailMap(false);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadShakemapStaticView();
  bindEventDetailMapTab();
  // Map is the default active tab — init after Leaflet (defer) is ready.
  const tryInit = () => {
    if (typeof L !== "undefined") {
      initEventDetailMap(false);
      return;
    }
    window.setTimeout(tryInit, 50);
  };
  tryInit();
});

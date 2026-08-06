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
    if (window.ShakeMap && window.ShakeMap.map && typeof google !== "undefined" && google.maps) {
      google.maps.event.trigger(window.ShakeMap.map, "resize");
    }
    return;
  }
  if (typeof window.initShakeMapMap !== "function") {
    return;
  }
  if (typeof window.isGoogleMapsReady === "function" && !window.isGoogleMapsReady()) {
    return;
  }
  if (typeof google === "undefined" || !google.maps) {
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

  await window.initShakeMapMap(eventPayload);
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

function showAlertSafe(type, message) {
  if (typeof showAlert === "function") {
    showAlert("alertPlaceholder", type, message);
  }
}

async function requireDetailAuth(permission, actionLabel) {
  const token = window.localStorage.getItem("access_token");
  if (!token) {
    showAlertSafe("danger", `Please log in to ${actionLabel}.`);
    return false;
  }

  if (typeof isTokenExpired === "function" && isTokenExpired(token)) {
    if (typeof refreshToken === "function") {
      const refreshed = await refreshToken();
      if (!refreshed) {
        showAlertSafe("danger", `Please sign in again to ${actionLabel}.`);
        return false;
      }
    } else {
      showAlertSafe("danger", `Please sign in again to ${actionLabel}.`);
      return false;
    }
  }

  if (typeof window.hasPermission === "function" && !window.hasPermission(permission)) {
    showAlertSafe("danger", `You do not have permission to ${actionLabel}.`);
    return false;
  }

  if (typeof window.makeApiRequest !== "function") {
    showAlertSafe("danger", "Authorization module failed to load.");
    return false;
  }

  return true;
}

function getDetailSeiscompOid() {
  const root = document.getElementById("shakemapStaticView");
  const oidFromRoot = (root?.dataset?.seiscompOid || "").trim();
  if (oidFromRoot) {
    return oidFromRoot;
  }
  const btn = document.getElementById("btnGenerateShakemap") || document.getElementById("btnTogglePublish");
  return (btn?.dataset?.seiscompOid || "").trim();
}

function getShakemapBadgeClass(status) {
  switch (status) {
    case "generated":
      return "badge text-bg-success";
    case "waiting":
    case "running":
      return "badge text-bg-warning text-dark";
    case "failed":
      return "badge text-bg-danger";
    case "pending":
    default:
      return "badge text-bg-info text-dark";
  }
}

function updateShakemapStatusUi(status) {
  const badge = document.getElementById("shakemapStatusBadge");
  const btn = document.getElementById("btnGenerateShakemap");
  const normalized = String(status || "pending").toLowerCase();

  if (badge) {
    badge.dataset.status = normalized;
    badge.className = getShakemapBadgeClass(normalized);
    badge.textContent = `ShakeMap: ${normalized}`;
  }

  if (!btn) {
    return;
  }

  const canShakemap =
    typeof window.hasPermission === "function" ? window.hasPermission("can_shakemap") : false;
  btn.classList.toggle("d-none", !canShakemap);

  const busy = normalized === "waiting" || normalized === "running";
  btn.disabled = busy;
  if (busy) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Running...';
  } else if (normalized === "generated") {
    btn.textContent = "Regenerate ShakeMap";
  } else {
    btn.textContent = "Generate ShakeMap";
  }
}

function updatePublishStatusUi(published) {
  const badge = document.getElementById("publishStatusBadge");
  const btn = document.getElementById("btnTogglePublish");
  const isPublished = Boolean(published);

  if (badge) {
    badge.dataset.published = isPublished ? "1" : "0";
    badge.className = isPublished ? "badge text-bg-success" : "badge text-bg-secondary";
    badge.textContent = isPublished ? "Published" : "Not published";
  }

  if (!btn) {
    return;
  }

  const canEvents =
    typeof window.hasPermission === "function" ? window.hasPermission("can_events") : false;
  btn.classList.toggle("d-none", !canEvents);
  btn.dataset.published = isPublished ? "1" : "0";
  btn.textContent = isPublished ? "Unpublish" : "Publish";
  btn.classList.toggle("btn-outline-warning", isPublished);
  btn.classList.toggle("btn-outline-success", !isPublished);
  btn.disabled = false;
}

function initDetailStatusActions() {
  const badge = document.getElementById("shakemapStatusBadge");
  const status = badge?.dataset?.status || "pending";
  updateShakemapStatusUi(status);

  const publishBadge = document.getElementById("publishStatusBadge");
  const published = publishBadge?.dataset?.published === "1";
  updatePublishStatusUi(published);

  const generateBtn = document.getElementById("btnGenerateShakemap");
  if (generateBtn) {
    generateBtn.addEventListener("click", onGenerateShakemapClick);
  }

  const publishBtn = document.getElementById("btnTogglePublish");
  if (publishBtn) {
    publishBtn.addEventListener("click", onTogglePublishClick);
  }
}

async function onGenerateShakemapClick() {
  const btn = document.getElementById("btnGenerateShakemap");
  if (!btn) {
    return;
  }
  if (!(await requireDetailAuth("can_shakemap", "generate ShakeMap"))) {
    return;
  }

  const seiscompOid = getDetailSeiscompOid() || (btn.dataset.seiscompOid || "").trim();
  if (!seiscompOid) {
    showAlertSafe("danger", "SeisComP OID is missing.");
    return;
  }

  btn.disabled = true;
  const previousLabel = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Queuing...';

  try {
    const payload = await window.makeApiRequest("/api/shakemap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ seiscomp_oid: seiscompOid }),
    });

    if (!payload || payload.error) {
      showAlertSafe("danger", payload?.error || "Failed to queue ShakeMap.");
      btn.disabled = false;
      btn.innerHTML = previousLabel;
      return;
    }

    showAlertSafe("success", payload.message || `ShakeMap queued (${seiscompOid}).`);
    updateShakemapStatusUi(payload.status || "waiting");
  } catch {
    showAlertSafe("danger", "Request failed while queueing ShakeMap.");
    btn.disabled = false;
    btn.innerHTML = previousLabel;
  }
}

async function onTogglePublishClick() {
  const btn = document.getElementById("btnTogglePublish");
  if (!btn) {
    return;
  }
  if (!(await requireDetailAuth("can_events", "publish this event"))) {
    return;
  }

  const seiscompOid = getDetailSeiscompOid() || (btn.dataset.seiscompOid || "").trim();
  if (!seiscompOid) {
    showAlertSafe("danger", "SeisComP OID is missing.");
    return;
  }

  const currentlyPublished = btn.dataset.published === "1";
  const endpoint = currentlyPublished ? "/api/unpublish_event" : "/api/publish_event";
  const actionText = currentlyPublished ? "unpublish" : "publish";
  const confirmMessage = currentlyPublished
    ? "Are you sure you want to unpublish this event?"
    : "Are you sure you want to publish this event?";

  const confirmed = window.showConfirmModal
    ? await window.showConfirmModal({
        title: currentlyPublished ? "Cancel publication" : "Publish event",
        message: confirmMessage,
        confirmText: currentlyPublished ? "Unpublish" : "Publish",
        cancelText: "Cancel",
        confirmClass: currentlyPublished ? "btn-warning" : "btn-success",
      })
    : window.confirm(confirmMessage);

  if (!confirmed) {
    return;
  }

  btn.disabled = true;
  const previousLabel = btn.textContent;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i>${
    currentlyPublished ? "Unpublishing..." : "Publishing..."
  }`;

  try {
    const data = await window.makeApiRequest(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ seiscomp_oid: seiscompOid }),
    });

    if (!data || data.error) {
      showAlertSafe("danger", data?.error || `Failed to ${actionText} event.`);
      btn.disabled = false;
      btn.textContent = previousLabel;
      return;
    }

    const nextPublished = data.published != null ? Boolean(data.published) : !currentlyPublished;
    updatePublishStatusUi(nextPublished);
    showAlertSafe("success", data.message || `Event ${actionText}ed successfully.`);
  } catch {
    showAlertSafe("danger", `Request failed while trying to ${actionText} event.`);
    btn.disabled = false;
    btn.textContent = previousLabel;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Helpers used on /events list; full detail UI only on /events/<oid>.
  const isDetailPage = Boolean(document.getElementById("shakemapStaticView"));
  if (!isDetailPage) {
    return;
  }

  loadShakemapStaticView();
  bindEventDetailMapTab();
  initDetailStatusActions();

  // Map tab — wait for Google Maps API (from base.html).
  const tryInit = (attemptsLeft = 100) => {
    const mapsReady =
      typeof window.isGoogleMapsReady === "function"
        ? window.isGoogleMapsReady()
        : typeof google !== "undefined" && !!google.maps;
    if (mapsReady && typeof window.initShakeMapMap === "function") {
      initEventDetailMap(false);
      return;
    }
    if (attemptsLeft <= 0) {
      const layerList = document.getElementById("layer-list");
      if (layerList) {
        layerList.innerHTML =
          '<div class="text-danger small">Google Maps failed to load; map unavailable. Check GOOGLE_MAPS_API_KEY.</div>';
      }
      return;
    }
    window.setTimeout(() => tryInit(attemptsLeft - 1), 50);
  };
  tryInit();
});

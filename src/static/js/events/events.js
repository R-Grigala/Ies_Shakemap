const eventsTableBody = document.getElementById("eventsTableBody");
const eventsStatus = document.getElementById("eventsStatus");
const eventsActionHeader = document.getElementById("eventsActionHeader");
const eventsById = new Map();
const getEventKey = (event) => String(event?.id ?? "");

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

async function requireEventsAuth(actionLabel = "perform this action") {
  let token = window.localStorage.getItem("access_token");
  if (!token) {
    showAlert("alertPlaceholder", "danger", `Please log in to ${actionLabel}.`);
    return false;
  }

  if (typeof isTokenExpired === "function" && isTokenExpired(token)) {
    if (typeof refreshToken === "function") {
      const refreshedToken = await refreshToken();
      if (!refreshedToken) {
        showAlert("alertPlaceholder", "danger", `Please sign in again to ${actionLabel}.`);
        return false;
      }
      token = refreshedToken;
    } else {
      showAlert("alertPlaceholder", "danger", `Please sign in again to ${actionLabel}.`);
      return false;
    }
  }

  const hasEventsPermission =
    typeof window.hasPermission === "function"
      ? window.hasPermission("can_events")
      : true;

  if (typeof window.hasPermission === "function" && !hasEventsPermission) {
    showAlert("alertPlaceholder", "danger", `You do not have permission to ${actionLabel}.`);
    return false;
  }

  return true;
}

function bindCreateEventAuthGuard() {
  const createEventButton = document.getElementById("btnCreateEvent");
  const createEventModalElement = document.getElementById("createEventModal");
  if (!createEventButton) {
    return;
  }

  const canManageEvents =
    typeof window.hasPermission === "function"
      ? window.hasPermission("can_events")
      : false;

  if (!canManageEvents) {
    createEventButton.classList.add("d-none");
    return;
  }

  createEventButton.classList.remove("d-none");

  createEventButton.removeAttribute("data-bs-toggle");
  createEventButton.removeAttribute("data-bs-target");

  createEventButton.addEventListener("click", async (event) => {
    event.preventDefault();
    if (!(await requireEventsAuth("add an earthquake"))) {
      if (createEventModalElement && typeof bootstrap !== "undefined") {
        bootstrap.Modal.getOrCreateInstance(createEventModalElement).hide();
      }
      return;
    }

    if (createEventModalElement && typeof bootstrap !== "undefined") {
      bootstrap.Modal.getOrCreateInstance(createEventModalElement).show();
    }
  });
}

function syncActionColumnVisibility(canManageEvents) {
  if (!eventsActionHeader) {
    return;
  }
  eventsActionHeader.classList.toggle("d-none", !canManageEvents);
}

function setPublishSwitchState(toggle, published) {
  toggle.dataset.published = published ? "1" : "0";
  toggle.checked = published;
  toggle.title = `Publish: ${published ? "ON" : "OFF"}`;
}

async function togglePublishEvent(toggle) {
  if (!(await requireEventsAuth("publish event"))) {
    toggle.checked = toggle.dataset.published === "1";
    return;
  }
  const seiscompOid = toggle.dataset.seiscompOid;
  if (!seiscompOid) {
    showAlert("alertPlaceholder", "danger", "SeisComP OID is missing.");
    toggle.checked = false;
    return;
  }
  const currentlyPublished = toggle.dataset.published === "1";
  const endpoint = currentlyPublished ? "/api/unpublish_event" : "/api/publish_event";
  const actionText = currentlyPublished ? "unpublish" : "publish";
  const confirmMessage = currentlyPublished
    ? "Are you sure you want to cancel publication for this event?"
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
    toggle.checked = currentlyPublished;
    return;
  }

  toggle.disabled = true;
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
      showAlert("alertPlaceholder", "danger", data?.error || `Failed to ${actionText} event.`);
      toggle.checked = currentlyPublished;
      return;
    }
    const nextPublished = !currentlyPublished;
    setPublishSwitchState(toggle, nextPublished);
    showAlert("alertPlaceholder", "success", data.message || `Event ${actionText}ed successfully.`);
  } catch {
    toggle.checked = currentlyPublished;
    showAlert("alertPlaceholder", "danger", `Request failed while trying to ${actionText} event.`);
  } finally {
    toggle.disabled = false;
  }
}

function bindPublishSwitches() {
  const toggles = document.querySelectorAll(".publish-toggle-switch");
  toggles.forEach((toggle) => {
    setPublishSwitchState(toggle, toggle.dataset.published === "1");
    toggle.addEventListener("change", async () => {
      await togglePublishEvent(toggle);
    });
  });
}


function renderEvents(events) {
  const canManageEvents =
    typeof window.hasPermission === "function"
      ? window.hasPermission("can_events")
      : false;
  syncActionColumnVisibility(canManageEvents);

  if (!Array.isArray(events) || events.length === 0) {
    eventsTableBody.innerHTML = "";
    eventsStatus.textContent = "No events found.";
    return;
  }

  const sortedEvents = [...events].sort((a, b) => {
    const aTime = new Date(a.origin_time || 0).getTime();
    const bTime = new Date(b.origin_time || 0).getTime();
    return bTime - aTime;
  });
  eventsById.clear();
  sortedEvents.forEach((event) => eventsById.set(getEventKey(event), event));
  window.eventsById = eventsById;

  eventsTableBody.innerHTML = sortedEvents
    .map(
      (event) => `
      <tr>
        ${
          canManageEvents
            ? `
        <td>
          <div class="d-flex align-items-center gap-1">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary edit-event-btn d-inline-flex align-items-center justify-content-center"
              onclick="openEditEventModal('${escapeHtml(event.id)}')"
              title="Edit event"
              aria-label="Edit event"
            >
              <img
                src="/static/img/pen-solid.svg"
                alt="Edit"
                style="width: 14px; height: 14px;"
              >
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center"
              onclick="deleteEvent('${escapeHtml(event.id)}')"
              title="Delete event"
              aria-label="Delete event"
            >
              <img
                src="/static/img/trash-solid.svg"
                alt="Delete"
                style="width: 14px; height: 14px;"
              >
            </button>
            <div class="form-check form-switch mt-1 publish-toggle-wrapper content-center">
              <input
                class="form-check-input publish-toggle-switch"
                type="checkbox"
                role="switch"
                data-seiscomp-oid="${escapeHtml(event.seiscomp_oid || "")}"
                data-published="${event.is_published || event.published ? "1" : "0"}"
                ${event.is_published || event.published ? "checked" : ""}
              >
            </div>
          </div>
        </td>
          `
            : ""
        }
        <td>${escapeHtml(event.event_id ?? "-")}</td>
        <td>${escapeHtml(event.seiscomp_oid)}</td>
        <td>${escapeHtml(event.origin_time)}</td>
        <td>${escapeHtml(event.ml)}</td>
        <td>${escapeHtml(event.depth)}</td>
        <td>${escapeHtml(event.latitude)}</td>
        <td>${escapeHtml(event.longitude)}</td>
        <td>${escapeHtml(event.location_en || event.location_ge || event.area || "-")}</td>
      </tr>
    `
    )
    .join("");

  bindPublishSwitches();
  eventsStatus.textContent = `Loaded ${sortedEvents.length} earthquakes.`;
}

function renderEventsAndMap(events) {
  renderEvents(events);
  if (typeof window.updateMapMarkers === "function") {
    window.updateMapMarkers(Array.isArray(events) ? events : []);
  }
}

async function loadEvents() {
  eventsStatus.textContent = "Loading earthquakes...";

  try {
    const response = await fetch("/api/events", {
      method: "GET",
      headers: { accept: "application/json" },
    });
    const payload = await response.json();

    if (!response.ok) {
      eventsTableBody.innerHTML = "";
      eventsStatus.textContent = payload.error || "Failed to load earthquakes.";
      return;
    }

    renderEventsAndMap(Array.isArray(payload) ? payload : []);
  } catch {
    eventsTableBody.innerHTML = "";
    eventsStatus.textContent = "Request failed while loading earthquakes.";
  }
}
window.escapeHtml = escapeHtml;
window.requireEventsAuth = requireEventsAuth;
window.renderEvents = renderEvents;
window.renderEventsAndMap = renderEventsAndMap;
window.loadEvents = loadEvents;

document.addEventListener("DOMContentLoaded", () => {
  bindCreateEventAuthGuard();
  loadEvents();
});

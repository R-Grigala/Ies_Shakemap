var markers = [];
var map;
var eventsMapInfoWindow = null;

function initMap() {
    var mapEl = document.getElementById("map");
    if (!mapEl || typeof google === "undefined" || !google.maps) {
        return;
    }
    var latlng = new google.maps.LatLng(42.264, 43.322);
    var myOptions = {
        zoom: 7,
        center: latlng,
        panControl: false,
        streetViewControl: false,
        mapTypeControl: true,
        mapTypeControlOptions: {style: google.maps.MapTypeControlStyle.DROPDOWN_MENU},
        mapTypeId: google.maps.MapTypeId.HYBRID,
        zoomControl: true,
        zoomControlOptions: {style: google.maps.ZoomControlStyle.SMALL}
    };
    map = new google.maps.Map(mapEl, myOptions);
    eventsMapInfoWindow = new google.maps.InfoWindow();
}

function resolveEventDetailUrl(event) {
    const oid = event && event.seiscomp_oid != null ? String(event.seiscomp_oid).trim() : "";
    if (!oid) {
        return null;
    }
    if (typeof window.getEventDetailUrl === "function") {
        return window.getEventDetailUrl(oid);
    }
    return `/events/${encodeURIComponent(oid)}`;
}

function escapeMapHtml(value) {
    if (typeof window.escapeHtml === "function") {
        return window.escapeHtml(value);
    }
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

function buildMarkerTitle(event) {
    const parts = [
        event.event_id != null ? `Event ID: ${event.event_id}` : null,
        event.ml != null ? `ML ${event.ml}` : null,
        event.location_en || event.location_ge || null,
    ].filter(Boolean);
    return parts.join(" · ") || "Earthquake event";
}

function formatMapValue(value, fallback) {
    if (value === null || value === undefined || value === "") {
        return fallback ?? "—";
    }
    return String(value);
}

/**
 * Marker popup: Location, Time, Magnitude + "დეტალურად".
 */
function buildEventInfoWindowContent(event, detailUrl) {
    const location =
        event.location_ge ||
        event.location_en ||
        event.area ||
        "—";
    const time = formatMapValue(event.origin_time);
    const ml =
        event.ml != null && event.ml !== ""
            ? `${event.ml} ML`
            : "—";

    const buttonHtml = detailUrl
        ? `<a href="${escapeMapHtml(detailUrl)}"
              style="display:inline-block;margin-top:8px;padding:6px 12px;
                     background:#0d6efd;color:#fff;text-decoration:none;
                     border-radius:4px;font-size:13px;font-weight:600;">
             დეტალურად
           </a>`
        : "";

    return `
      <div style="min-width:200px;max-width:280px;font-family:Arial,sans-serif;line-height:1.35;">
        <div style="margin-bottom:6px;">
          <span style="color:#6c757d;font-size:11px;">Location</span><br>
          <strong style="font-size:13px;">${escapeMapHtml(location)}</strong>
        </div>
        <div style="margin-bottom:6px;">
          <span style="color:#6c757d;font-size:11px;">Time</span><br>
          <strong style="font-size:13px;">${escapeMapHtml(time)}</strong>
        </div>
        <div style="margin-bottom:6px;">
          <span style="color:#6c757d;font-size:11px;">Magnitude</span><br>
          <strong style="font-size:13px;">${escapeMapHtml(ml)}</strong>
        </div>
        <div style="margin-top:6px;border-top:1px solid #e9ecef;padding-top:8px;text-align:center;">
          ${buttonHtml}
        </div>
      </div>
    `;
}

function updateMapMarkers(events) {
    markers.forEach((marker) => marker.setMap(null));
    markers = [];

    if (!map || !Array.isArray(events)) {
        return;
    }
    if (!eventsMapInfoWindow) {
        eventsMapInfoWindow = new google.maps.InfoWindow();
    }

    events.forEach((event) => {
        var latitude = parseFloat(event.latitude);
        var longitude = parseFloat(event.longitude);
        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            return;
        }

        var marker = new google.maps.Marker({
            position: { lat: latitude, lng: longitude },
            map: map,
            title: buildMarkerTitle(event),
            cursor: "pointer",
            icon: {
                url: "/static/img/event_red.png",
                scaledSize: new google.maps.Size(20, 20),
            },
        });
        attachEventInfoWindow(marker, event);
        markers.push(marker);
    });
}

function attachEventInfoWindow(marker, event) {
    const detailUrl = resolveEventDetailUrl(event);
    const content = buildEventInfoWindowContent(event, detailUrl);

    marker.addListener("click", function () {
        eventsMapInfoWindow.setContent(content);
        eventsMapInfoWindow.open({
            map: map,
            anchor: marker,
        });
    });
}

document.addEventListener("DOMContentLoaded", function () {
    initMap();
});

window.updateMapMarkers = updateMapMarkers;

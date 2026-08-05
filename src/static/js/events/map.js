var markers = [];
var map;

function initMap() {
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
    map = new google.maps.Map(document.getElementById("map"), myOptions);
}

function resolveEventDetailUrl(event) {
    if (event == null || event.id === undefined || event.id === null || event.id === "") {
        return null;
    }
    if (typeof window.getEventDetailUrl === "function") {
        return window.getEventDetailUrl(event.id);
    }
    return `/events/${encodeURIComponent(event.id)}`;
}

function buildMarkerTitle(event) {
    const parts = [
        event.event_id != null ? `Event ID: ${event.event_id}` : null,
        event.ml != null ? `ML ${event.ml}` : null,
        event.location_en || event.location_ge || null,
    ].filter(Boolean);
    return parts.join(" · ") || "Earthquake event";
}

function updateMapMarkers(events) {
    // Remove existing markers from the map
    markers.forEach(marker => marker.setMap(null));
    markers = []; // Clear the markers array

    if (!map || !Array.isArray(events)) {
        return;
    }

    events.forEach(event => {
        var latitude = parseFloat(event.latitude);
        var longitude = parseFloat(event.longitude);
        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            return;
        }

        var marker = new google.maps.Marker({
            position: {lat: latitude, lng: longitude},
            map: map,
            title: buildMarkerTitle(event),
            cursor: "pointer",
            icon: {
                url: '/static/img/event_red.png',
                scaledSize: new google.maps.Size(20, 20)
            }
        });
        attachEventDetailNavigation(marker, event);
        markers.push(marker); // Add marker to the array
    });
}

function attachEventDetailNavigation(marker, event) {
    var detailUrl = resolveEventDetailUrl(event);
    if (!detailUrl) {
        return;
    }

    marker.addListener("click", function () {
        window.location.href = detailUrl;
    });
}

// Initialize the map when the page loads
document.addEventListener("DOMContentLoaded", function() {
    initMap();
});

window.updateMapMarkers = updateMapMarkers;

import logging

from flask_restx import Resource

from src.api.nsmodels import publish_event_ns, publish_event_parser, publish_event_model
from src.config import Config
from src.models import SeismicEvent, PublishedEarthquake
from src.services.wp_publish_client import publish_eq, unpublish_eq
from src.utils import is_authorized_request, have_permission

logger = logging.getLogger("app.events")


def _authorize_publish_request():
    if not is_authorized_request():
        return {"error": "Access denied. Provide a valid X-API-Key or JWT token."}, 401
    if not have_permission("can_events"):
        return {"error": "You do not have permission to publish earthquakes."}, 403
    return None


def _load_event_and_code(args):
    seiscomp_oid = (args.get("seiscomp_oid") or "").strip()
    if not seiscomp_oid:
        return None, None, {"error": "SeisComP OID is required."}, 400

    event = SeismicEvent.query.filter_by(seiscomp_oid=seiscomp_oid).first()
    if not event:
        return None, None, {"error": f"Earthquake event not found: {seiscomp_oid}"}, 404

    publish_code = (getattr(Config, "WP_PUBLISH_CODE", "") or "").strip()
    if not publish_code:
        return None, None, {"error": "WP_PUBLISH_CODE is not configured."}, 500

    return event, publish_code, None, None


@publish_event_ns.route("/publish_event")
@publish_event_ns.doc(
    responses={
        200: "OK",
        400: "Invalid Argument",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        500: "Internal Server Error",
        502: "Bad Gateway",
    }
)
class PublishEventAPI(Resource):
    @publish_event_ns.expect(publish_event_model)
    @publish_event_ns.doc(
        security=[{"ApiKeyAuth": []}, {"JsonWebToken": []}],
        description="Publish event to ies.iliauni.edu.ge by seiscomp_oid",
    )
    def post(self):
        auth_error = _authorize_publish_request()
        if auth_error:
            return auth_error

        args = publish_event_parser.parse_args()
        event, publish_code, load_error, load_status = _load_event_and_code(args)
        if load_error:
            return load_error, load_status
        seiscomp_oid = event.seiscomp_oid

        try:
            wp_response = publish_eq(
                eq_id=event.event_id if event.event_id is not None else event.seiscomp_oid,
                code=publish_code,
                uccur_time=event.origin_time.strftime("%Y-%m-%d %H:%M:%S"),
                latitude=event.latitude,
                longitude=event.longitude,
                mag=event.ml,
                mag_type="ML",
                eq_type="A",
                depth=event.depth,
                description_ge=event.location_ge or "",
                description_en=event.location_en or "",
                region_ge=event.location_ge or "",
                region_en=event.location_en or "",
            )
        except Exception as exc:
            logger.exception("Publish event failed: seiscomp_oid=%s", seiscomp_oid)
            return {"error": f"Publish request failed: {exc}"}, 502

        logger.info(
            "Publish event completed: seiscomp_oid=%s wp_response=%s",
            seiscomp_oid,
            wp_response,
        )

        published_row = PublishedEarthquake.query.filter_by(seiscomp_oid=seiscomp_oid).first()
        if not published_row:
            published_row = PublishedEarthquake(seiscomp_oid=seiscomp_oid, wp_response=wp_response)
            published_row.create(commit=False)
        else:
            published_row.wp_response = wp_response
        published_row.save()

        return {
            "message": "Publish request completed.",
            "seiscomp_oid": seiscomp_oid,
            "wp_response": wp_response,
            "published": True,
        }, 200


@publish_event_ns.route("/unpublish_event")
@publish_event_ns.doc(
    responses={
        200: "OK",
        400: "Invalid Argument",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        500: "Internal Server Error",
        502: "Bad Gateway",
    }
)
class UnpublishEventAPI(Resource):
    @publish_event_ns.expect(publish_event_model)
    @publish_event_ns.doc(
        security=[{"ApiKeyAuth": []}, {"JsonWebToken": []}],
        description="Unpublish event from ies.iliauni.edu.ge by seiscomp_oid",
    )
    def post(self):
        auth_error = _authorize_publish_request()
        if auth_error:
            return auth_error

        args = publish_event_parser.parse_args()
        event, publish_code, load_error, load_status = _load_event_and_code(args)
        if load_error:
            return load_error, load_status
        seiscomp_oid = event.seiscomp_oid

        try:
            wp_response = unpublish_eq(
                eq_id=event.event_id if event.event_id is not None else event.seiscomp_oid,
                code=publish_code,
            )
        except Exception as exc:
            logger.exception("Unpublish event failed: seiscomp_oid=%s", seiscomp_oid)
            return {"error": f"Unpublish request failed: {exc}"}, 502

        logger.info(
            "Unpublish event completed: seiscomp_oid=%s wp_response=%s",
            seiscomp_oid,
            wp_response,
        )
        published_row = PublishedEarthquake.query.filter_by(seiscomp_oid=seiscomp_oid).first()
        if published_row:
            published_row.delete()
        return {
            "message": "Unpublish request completed.",
            "seiscomp_oid": seiscomp_oid,
            "wp_response": wp_response,
            "published": False,
        }, 200

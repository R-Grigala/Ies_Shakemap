from flask_restx import reqparse, fields
from src.extensions import api

publish_event_ns = api.namespace(
    "Publish Event",
    description="API endpoint for publishing events to WordPress",
    path="/api",
)

publish_event_model = api.model(
    "PublishEventPayload",
    {
        "seiscomp_oid": fields.String(required=True, description="SeisComP OID"),
    },
)

publish_event_parser = reqparse.RequestParser()
publish_event_parser.add_argument(
    "seiscomp_oid",
    type=str,
    required=True,
    help="SeisComP OID is required",
)

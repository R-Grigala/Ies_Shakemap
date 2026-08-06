import os
import logging
from datetime import datetime, timezone

from flask_restx import Resource
from flask import request, send_file
from flask_jwt_extended import get_jwt_identity

from src.utils import is_authorized_request, have_permission
from src.api.nsmodels import shakemap_ns, shakemap_parser, shakemap_model
from src.models import SeismicEvent, ShakemapJob, User
from src.tasks.shakemap import run_shakemap
from src.config import Config

SHAKEMAP_BASE_PATH = Config.SHAKEMAP_BASE_PATH
# დაშვებული სურათების ტიპები (products ფოლდერში)
ALLOWED_IMAGES = {
    "intensity": "intensity.jpg",
    "pga": "pga.jpg",
    "pgv": "pgv.jpg",
    "psa0p3": "psa0p3.jpg",  # PSA 0.3s
    "psa1p0": "psa1p0.jpg",  # PSA 1.0s
    "psa3p0": "psa3p0.jpg",  # PSA 3.0s
}

# Leaflet map-ისთვის დასაშვები product ფაილები (path traversal-ისგან დაცული allowlist)
ALLOWED_PRODUCT_FILES = {
    "info.json": "application/json",
    "cont_mi.json": "application/json",
    "cont_pga.json": "application/json",
    "cont_pgv.json": "application/json",
    "cont_psa0p3.json": "application/json",
    "cont_psa1p0.json": "application/json",
    "cont_psa3p0.json": "application/json",
    "stationlist.json": "application/json",
    "rupture.json": "application/json",
    "mmi_legend.png": "image/png",
}


def _products_dir(seiscomp_oid):
    return os.path.join(SHAKEMAP_BASE_PATH, seiscomp_oid, "current", "products")


def _resolve_product_path(seiscomp_oid, filename):
    """აბრუნებს (absolute_path, mimetype) ან (None, error_reason)."""
    safe_name = os.path.basename(filename or "")
    mimetype = ALLOWED_PRODUCT_FILES.get(safe_name)
    if not mimetype:
        return None, "unsupported"
    products_path = os.path.abspath(_products_dir(seiscomp_oid))
    file_path = os.path.abspath(os.path.join(products_path, safe_name))
    if not file_path.startswith(products_path + os.sep) and file_path != products_path:
        return None, "invalid_path"
    if not os.path.isfile(file_path):
        return None, "missing"
    return file_path, mimetype


logger = logging.getLogger("app.shakemap_api")

@shakemap_ns.route("/shakemap")
@shakemap_ns.doc(
    responses={
        200: 'OK',
        201: 'Created',
        400: 'Invalid Argument',
        401: 'Unauthorized',
        404: 'Not Found'
    }
)
class RunShakeMap(Resource):
    @shakemap_ns.doc(parser=shakemap_parser)
    @shakemap_ns.doc(
        security=[{'ApiKeyAuth': []}, {'JsonWebToken': []}],
        description='Run ShakeMap using X-API-Key or JWT Bearer token',
    )
    def post(self):
        # --- მოთხოვნის body-ის დამუშავება ---
        args = shakemap_parser.parse_args()
        seiscomp_oid = args["seiscomp_oid"]
        # --- ავტორიზაციის შემოწმება ---
        if not is_authorized_request():
            logger.warning("ShakeMap run denied: seiscomp_oid=%s unauthorized", seiscomp_oid)
            return {'error': 'Access denied. Provide a valid X-API-Key or JWT token.'}, 401

        # --- უფლების შემოწმება ---
        if not have_permission("can_shakemap"):
            logger.warning("ShakeMap run denied: missing can_shakemap permission")
            return {'error': 'You do not have permission to run ShakeMap.'}, 403

        try:
            logger.info("ShakeMap run requested: seiscomp_oid=%s", seiscomp_oid)
            # --- მოვლენის მოძებნა seiscomp_oid-ით ---
            event = SeismicEvent.query.filter_by(seiscomp_oid=seiscomp_oid).first()
            if not event:
                logger.info("ShakeMap run failed: seiscomp_oid=%s not found", seiscomp_oid)
                return {"error": f"Event not found: {seiscomp_oid}"}, 404

            shakemap_job = ShakemapJob.query.filter_by(seiscomp_oid=seiscomp_oid).first()
            api_key = request.headers.get("X-API-Key")
            api_user = User.query.filter_by(email="api_user@iliauni.edu.ge").first()
            user_uuid = api_user.uuid if api_key else get_jwt_identity()

            
            if not shakemap_job:
                shakemap_job = ShakemapJob(
                    seiscomp_oid=seiscomp_oid,
                    uuid=user_uuid,
                    status=ShakemapJob.STATUS_WAITING,
                    started_at=None,
                    finished_at=None,
                    error=None,
                )
                shakemap_job.create()
                logger.info("ShakeMap job created: seiscomp_oid=%s", seiscomp_oid)

            elif shakemap_job.status in (
                ShakemapJob.STATUS_RUNNING,
                ShakemapJob.STATUS_WAITING
            ):
                logger.info("ShakeMap run skipped: seiscomp_oid=%s already queued/running", seiscomp_oid)
                return {"error": f"Event is already queued or running: {seiscomp_oid}"}, 409
            else:
                # დასრულებული/failed job-ის ხელახლა გაშვებისას ისევ რიგში ჩავსვათ.
                shakemap_job.status = ShakemapJob.STATUS_WAITING
                shakemap_job.started_at = None
                shakemap_job.finished_at = None
                shakemap_job.error = None
                shakemap_job.uuid = user_uuid
                shakemap_job.save()

            # --- Celery queue-ში დამატება ---
            async_result = run_shakemap.delay(shakemap_job.id)
            shakemap_job.celery_task_id = async_result.id
            shakemap_job.save()

            logger.info("ShakeMap queued: seiscomp_oid=%s task_id=%s", seiscomp_oid, async_result.id)
            return {
                "status": "waiting",
                "message": "Computation has been queued.",
                "seiscomp_oid": seiscomp_oid,
                "job_id": shakemap_job.id,
                "task_id": async_result.id,
            }, 202
        except Exception as e:
            shakemap_job = ShakemapJob.query.filter_by(seiscomp_oid=seiscomp_oid).first()
            if shakemap_job:
                shakemap_job.status = ShakemapJob.STATUS_FAILED
                shakemap_job.finished_at = datetime.now(timezone.utc)
                shakemap_job.error = str(e)
                shakemap_job.save()
            logger.exception("ShakeMap run exception: seiscomp_oid=%s", seiscomp_oid)
            return {
                "status": "failed",
                "event_id": seiscomp_oid,
                "error": str(e)
            }, 500


# --- ShakeMap შედეგები ---
@shakemap_ns.route("/shakemap/<string:seiscomp_oid>")
@shakemap_ns.doc(
    params={
        "seiscomp_oid": "SeisComP Event OID",
    },
    responses={
        200: 'OK',
        400: 'Invalid Argument',
        404: 'Not Found'
    }
)
class ShakeMapResults(Resource):
    def get(self, seiscomp_oid):
        """აბრუნებს კონკრეტული მოვლენის ShakeMap პროდუქტებს."""
        shakemap_job = ShakemapJob.query.filter_by(seiscomp_oid=seiscomp_oid).first()
        if not shakemap_job:
            logger.info("ShakeMap results failed: seiscomp_oid=%s not found", seiscomp_oid)
            return {"error": f"Event not found: {seiscomp_oid}"}, 404

        products_path = _products_dir(seiscomp_oid) if seiscomp_oid else None
        images = []
        for key, filename in ALLOWED_IMAGES.items():
            file_path = os.path.join(products_path, filename)
            images.append(
                {
                    "type": key,
                    "filename": filename,
                    "exists": os.path.exists(file_path),
                    "url": f"/api/shakemap/{seiscomp_oid}/image/{key}",
                }
            )

        return {
            "status": "success",
            "event_id": seiscomp_oid,
            "products_path": products_path,
            "images": images,
        }, 200


@shakemap_ns.route("/shakemap/<string:seiscomp_oid>/image/<string:image_type>")
@shakemap_ns.doc(
    params={
        "seiscomp_oid": "SeisComP Event OID",
        "image_type": "ShakeMap image type: intensity, pga, pgv, psa0p3 (0.3s), psa1p0 (1.0s), psa3p0 (3.0s)",
    },
    responses={
        200: 'OK',
        400: 'Invalid Argument',
        404: 'Not Found'
    }
)
class ShakeMapResultImage(Resource):
    def get(self, seiscomp_oid, image_type):
        """აბრუნებს ShakeMap სურათს SeisComP OID-ის მიხედვით."""
        event = SeismicEvent.query.filter_by(seiscomp_oid=seiscomp_oid).first()
        if not event:
            logger.info("ShakeMap image failed: seiscomp_oid=%s event not found", seiscomp_oid)
            return {"error": f"Event not found: {seiscomp_oid}"}, 404

        filename = ALLOWED_IMAGES.get(image_type)
        if not filename:
            logger.info(
                "ShakeMap image failed: seiscomp_oid=%s unsupported image_type=%s",
                seiscomp_oid,
                image_type,
            )
            return {"error": f"Unsupported image type: {image_type}"}, 400

        products_path = _products_dir(seiscomp_oid)
        file_path = os.path.join(products_path, filename)
        if not os.path.exists(file_path):
            logger.info(
                "ShakeMap image failed: seiscomp_oid=%s missing file=%s",
                seiscomp_oid,
                filename,
            )
            return {"error": f"Image not found: {filename}"}, 404

        logger.info(
            "ShakeMap image success: seiscomp_oid=%s image_type=%s",
            seiscomp_oid,
            image_type,
        )
        return send_file(file_path, mimetype="image/jpeg")


@shakemap_ns.route("/shakemap/<string:seiscomp_oid>/product/<string:filename>")
@shakemap_ns.doc(
    params={
        "seiscomp_oid": "SeisComP Event OID",
        "filename": (
            "Product file from current/products "
            "(info.json, cont_*.json, stationlist.json, rupture.json, mmi_legend.png)"
        ),
    },
    responses={
        200: "OK",
        400: "Invalid Argument",
        404: "Not Found",
    },
)
class ShakeMapProductFile(Resource):
    def get(self, seiscomp_oid, filename):
        """აბრუნებს ShakeMap product ფაილს (GeoJSON/JSON/PNG) კონკრეტული ივენთისთვის."""
        event = SeismicEvent.query.filter_by(seiscomp_oid=seiscomp_oid).first()
        if not event:
            logger.info("ShakeMap product failed: seiscomp_oid=%s event not found", seiscomp_oid)
            return {"error": f"Event not found: {seiscomp_oid}"}, 404

        file_path, result = _resolve_product_path(seiscomp_oid, filename)
        if result == "unsupported":
            return {"error": f"Unsupported product file: {filename}"}, 400
        if result == "invalid_path":
            return {"error": "Invalid product path."}, 400
        if result == "missing" or not file_path:
            logger.info(
                "ShakeMap product missing: seiscomp_oid=%s file=%s",
                seiscomp_oid,
                filename,
            )
            return {"error": f"Product not found: {filename}"}, 404

        logger.info(
            "ShakeMap product success: seiscomp_oid=%s file=%s",
            seiscomp_oid,
            os.path.basename(file_path),
        )
        return send_file(file_path, mimetype=result)

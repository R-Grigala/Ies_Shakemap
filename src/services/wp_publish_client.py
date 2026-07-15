import requests


WP_AJAX_URL = "https://ies-staging.iliauni.edu.ge/wp-admin/admin-ajax.php"


def _post_wp_ajax(payload, timeout=20):
    response = requests.post(WP_AJAX_URL, data=payload, timeout=timeout)
    response.raise_for_status()
    return response.text.strip()


def publish_eq(
    *,
    eq_id,
    code,
    uccur_time,
    latitude,
    longitude,
    mag,
    mag_type,
    eq_type,
    depth,
    description_ge="",
    description_en="",
    region_ge="",
    region_en="",
    strike=None,
    dip=None,
    rake=None,
    important=0,
    timeout=20,
):
    """
    Publish or update earthquake in WordPress endpoint.
    Mirrors JS action: action=insert_update_eq
    """
    payload = {
        "action": "insert_update_eq",
        "id": eq_id,
        "uccur_time": uccur_time,
        "latitude": latitude,
        "longitude": longitude,
        "mag": mag,
        "mag_type": mag_type,
        "type": eq_type,  # A or M
        "depth": depth,
        "description_ge": description_ge,
        "description_en": description_en,
        "region_ge": region_ge,
        "region_en": region_en,
        "strike": strike,
        "dip": dip,
        "rake": rake,
        "important": important,
        "code": code,
    }
    return _post_wp_ajax(payload, timeout=timeout)


def unpublish_eq(*, eq_id, code, timeout=20):
    """Unpublish earthquake in WordPress endpoint. action=unpublish_eq"""
    payload = {
        "action": "unpublish_eq",
        "id": eq_id,
        "code": code,
    }
    return _post_wp_ajax(payload, timeout=timeout)


def check_if_eq_exists(*, eq_id, code, timeout=20):
    """Check publish state in WordPress endpoint. action=check_if_eq_exists"""
    payload = {
        "action": "check_if_eq_exists",
        "id": eq_id,
        "code": code,
    }
    return _post_wp_ajax(payload, timeout=timeout)

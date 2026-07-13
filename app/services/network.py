"""Server-side location verification for clock-in.

Design: clock-in is NEVER blocked — an employee can clock in from anywhere. We
instead classify *where* it happened so admins get more certainty that on-site
clock-ins really are on-site:

  office_ip      the request reached the server FROM the office's public/WAN IP.
                 Strong signal — the client cannot fake the source of the
                 connection. This is the trusted one.
  office_subnet  the device REPORTED a LAN IP matching the agency's subnet.
                 Weak/secondary hint — spoofable and 192.168.x is common at home.
  off_site       neither matched (remote / unverified).

The public-IP signal only works when the API is reachable over the real network
(i.e. hosted), and requires the reverse proxy to forward the real client IP (see
get_client_ip). Bind the app to localhost behind the proxy so X-Forwarded-For
cannot be spoofed by a client talking to it directly.
"""

from fastapi import Request

# Precedence: strongest signal wins.
SOURCE_OFFICE_IP = "office_ip"
SOURCE_OFFICE_SUBNET = "office_subnet"
SOURCE_OFF_SITE = "off_site"


def get_client_ip(request: Request) -> str | None:
    """Real client public IP. Behind a proxy that sets X-Forwarded-For, take the
    first hop; otherwise the direct connection IP (dev / no proxy)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _matches(value: str | None, patterns: list[str]) -> bool:
    """Exact or prefix match (so '203.0.113.' can cover a range)."""
    if not value:
        return False
    return any(value == p or value.startswith(p) for p in patterns)


def classify_location(
    public_ip: str | None,
    local_ip: str | None,
    network_config: dict | None,
) -> tuple[bool, str]:
    """Returns (location_verified, verification_source)."""
    cfg = network_config or {}
    allowed_public = list(cfg.get("allowed_public_ips") or [])
    allowed_subnets = list(cfg.get("allowed_subnets") or [])

    if _matches(public_ip, allowed_public):
        return True, SOURCE_OFFICE_IP
    if _matches(local_ip, allowed_subnets):
        return True, SOURCE_OFFICE_SUBNET
    return False, SOURCE_OFF_SITE

"""Vercel route for ``POST /api/research``."""

from local_http_server import SwarmRequestHandler


class handler(SwarmRequestHandler):
    """Reuse the local HTTP handler for the Vercel function route."""

    pass

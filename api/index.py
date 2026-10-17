"""Vercel serverless entry point for the Swarm Signal HTTP handler."""

from local_http_server import SwarmRequestHandler


class handler(SwarmRequestHandler):
    """Expose the existing stdlib handler through Vercel's Python runtime."""

    pass

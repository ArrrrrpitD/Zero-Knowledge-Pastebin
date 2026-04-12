"""
Rate limiter instance shared across routers.
Separated into its own module to avoid circular imports.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# 60 requests/min global default; individual routes can override
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

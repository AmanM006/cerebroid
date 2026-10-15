"""Cap on concurrent heavy computations (uncached profiles, tipping sweeps).

On the small host one of these takes seconds of CPU; without a cap a burst of distinct requests
queues dozens of them and stalls every page. At most `heavy_concurrency` run at once; others wait up
to `heavy_wait_seconds`, then get 503 SERVER_BUSY with Retry-After. Cached results never wait.
"""
import threading
from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import status

from app.core.config import get_settings
from app.core.errors import AppError

_semaphore: threading.BoundedSemaphore | None=None
_lock=threading.Lock()


def _slots() -> threading.BoundedSemaphore:
    global _semaphore
    with _lock:
        if _semaphore is None:
            _semaphore=threading.BoundedSemaphore(get_settings().heavy_concurrency)
        return _semaphore


@contextmanager
def heavy_slot() -> Iterator[None]:
    """Runs a heavy computation only when one of the limited slots is free."""
    slots=_slots()
    if not slots.acquire(timeout=get_settings().heavy_wait_seconds):
        raise AppError("SERVER_BUSY", "The server is busy with other analyses. Please retry shortly.",
                       status.HTTP_503_SERVICE_UNAVAILABLE, headers={"Retry-After": "10"})
    try:
        yield
    finally:
        slots.release()


def reset() -> None:
    """Recreates the slots from current settings (tests)."""
    global _semaphore
    with _lock:
        _semaphore=None

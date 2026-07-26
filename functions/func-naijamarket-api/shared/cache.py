import time
import threading
from typing import Any, Optional

_TTL = {"pg": 60, "digest": 300, "ref": 3600}
_DEFAULT_TTL = 60
_store = {}
_lock  = threading.Lock()

def _ttl_for(ns): return _TTL.get(ns, _DEFAULT_TTL)

def get_cache(namespace, key):
    with _lock:
        ns = _store.get(namespace)
        if not ns: return None
        entry = ns.get(key)
        if not entry: return None
        value, expires_at = entry
        if time.monotonic() > expires_at:
            del ns[key]
            return None
        return value

def set_cache(namespace, key, value, ttl=None):
    ttl = ttl if ttl is not None else _ttl_for(namespace)
    expires_at = time.monotonic() + ttl
    with _lock:
        if namespace not in _store: _store[namespace] = {}
        _store[namespace][key] = (value, expires_at)

def invalidate_cache(namespace, key):
    with _lock:
        ns = _store.get(namespace)
        if ns and key in ns: del ns[key]

def invalidate_namespace(namespace):
    with _lock: _store.pop(namespace, None)

def check_rate_limit(ip: str, endpoint: str, max_requests: int, window_sec: int = 60) -> bool:
    """Returns True if request is allowed, False if rate limited."""
    key = f"{endpoint}:{ip}"
    now = time.monotonic()
    with _lock:
        if "rl" not in _store:
            _store["rl"] = {}
        entry = _store["rl"].get(key)
        if entry:
            count, window_start = entry
            if now - window_start < window_sec:
                if count >= max_requests:
                    return False
                _store["rl"][key] = (count + 1, window_start)
            else:
                _store["rl"][key] = (1, now)
        else:
            _store["rl"][key] = (1, now)
    return True

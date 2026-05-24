"""
Tushare Python 客户端初始化模块（带请求节流）。

其他脚本统一通过 `from tushare_client import pro` 引用，
避免在各处重复写入 token 和自定义 HTTP 地址。

所有通过 pro 发出的请求自动排队，保证最小间隔 +
60秒滑动窗口（默认 500次/分钟），并在限频时自动重试。
"""

import os
import time
import threading
from collections import deque
from dotenv import load_dotenv
import tushare as ts

load_dotenv()

TUSHARE_TOKEN = os.getenv("TUSHARE_TOKEN", "19791a1368ca82dd8c2944203e522646d214cbbf7f66de71b0df1490")
TUSHARE_HTTP_URL = os.getenv("TUSHARE_HTTP_URL", "http://124.220.22.110:8020/")
TUSHARE_MIN_INTERVAL_MS = int(os.getenv("TUSHARE_MIN_INTERVAL_MS", "120"))
TUSHARE_MAX_CALLS_PER_MINUTE = int(os.getenv("TUSHARE_MAX_CALLS_PER_MINUTE", "500"))
TUSHARE_RATE_LIMIT_RETRY_MS = int(os.getenv("TUSHARE_RATE_LIMIT_RETRY_MS", "1200"))


class _ThrottledProApi:
    """包装 ts.pro_api，串行排队 + 最小间隔 + 60s 滑动窗口限流 + 限频重试。"""

    _RATE_LIMIT_KEYWORDS = ("频率超限", "rate limit", "too many requests", "429", "访问过于频繁")

    def __init__(self, raw_pro):
        self._raw = raw_pro
        self._lock = threading.Lock()
        self._next_allowed_at = 0.0
        self._call_times: deque[float] = deque()  # 最近 60s 内调用时刻

    def __getattr__(self, name):
        raw_attr = getattr(self._raw, name)
        if not callable(raw_attr):
            return raw_attr

        def throttled(*args, **kwargs):
            for attempt in (1, 2):
                with self._lock:
                    now = time.monotonic()

                    # 1) 清理 60 秒前的旧记录
                    cutoff = now - 60.0
                    while self._call_times and self._call_times[0] < cutoff:
                        self._call_times.popleft()

                    # 2) 已达 1 分钟上限 → 等到最早那次请求的窗口过期
                    if len(self._call_times) >= TUSHARE_MAX_CALLS_PER_MINUTE:
                        wait_s = self._call_times[0] + 60.0 - now
                        if wait_s > 0:
                            time.sleep(wait_s)
                            now = time.monotonic()
                            cutoff = now - 60.0
                            while self._call_times and self._call_times[0] < cutoff:
                                self._call_times.popleft()

                    # 3) 最小间隔
                    wait = self._next_allowed_at - now
                    if wait > 0:
                        time.sleep(wait)

                    result = raw_attr(*args, **kwargs)
                    now_after = time.monotonic()
                    self._next_allowed_at = now_after + TUSHARE_MIN_INTERVAL_MS / 1000.0
                    self._call_times.append(now_after)

                if not self._is_rate_limited(result):
                    return result

                if attempt == 1:
                    time.sleep(TUSHARE_RATE_LIMIT_RETRY_MS / 1000.0)

            return result

        return throttled

    @staticmethod
    def _is_rate_limited(result):
        try:
            if hasattr(result, "empty") and result.empty:
                return False
            if hasattr(result, "iloc"):
                first_val = str(result.iloc[0, 0]) if not result.empty else ""
            elif isinstance(result, dict):
                first_val = str(result.get("msg", ""))
            else:
                return False
            return any(kw in first_val.lower() for kw in _ThrottledProApi._RATE_LIMIT_KEYWORDS)
        except Exception:
            return False


_raw = ts.pro_api(TUSHARE_TOKEN)
_raw._DataApi__http_url = TUSHARE_HTTP_URL
pro = _ThrottledProApi(_raw)
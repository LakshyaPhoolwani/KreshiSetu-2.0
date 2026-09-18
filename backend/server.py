"""
KrishiSetu backend entrypoint.

Because the supervisor config is read-only and mandates `uvicorn server:app` on :8001,
this FastAPI process performs two jobs:

1. Ensures the local PostgreSQL cluster is running.
2. Spawns and supervises the Node.js/Express + Prisma backend on internal port 8002.
3. Reverse-proxies every `/api/*` request (including SSE streams) to the Node backend.

The frontend continues to call `${REACT_APP_BACKEND_URL}/api/...` unchanged. All
real business logic (Prisma, auth, net-realisation, recommendations, AI) lives in
`/app/node_backend`.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import shutil
import signal
import subprocess
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

NODE_BACKEND_DIR = Path("/app/node_backend")
NODE_BACKEND_PORT = int(os.environ.get("NODE_BACKEND_PORT", "8002"))
NODE_BACKEND_URL = f"http://127.0.0.1:{NODE_BACKEND_PORT}"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("krishisetu.proxy")

app = FastAPI(title="KrishiSetu Proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_node_proc: Optional[subprocess.Popen] = None
_http_client: Optional[httpx.AsyncClient] = None


def _ensure_postgres_running() -> None:
    """Best-effort start of the local PostgreSQL 15 cluster."""
    if not shutil.which("pg_ctlcluster"):
        logger.warning("pg_ctlcluster not found; skipping postgres bootstrap")
        return
    try:
        result = subprocess.run(["pg_lsclusters", "-h"], capture_output=True, text=True, timeout=10)
        if "online" in result.stdout:
            return
        subprocess.run(["pg_ctlcluster", "15", "main", "start"], check=False, capture_output=True, text=True, timeout=30)
        logger.info("started postgres cluster")
    except Exception as exc:  # pragma: no cover
        logger.warning("failed to start postgres: %s", exc)


def _start_node_backend() -> None:
    global _node_proc
    if _node_proc and _node_proc.poll() is None:
        return
    env = os.environ.copy()
    env.setdefault("PORT", str(NODE_BACKEND_PORT))
    logger.info("starting node backend on :%s", NODE_BACKEND_PORT)
    _node_proc = subprocess.Popen(
        ["node", "src/index.js"],
        cwd=str(NODE_BACKEND_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    # Forward node logs to our stdout so supervisor logs stay useful
    def _pump() -> None:
        assert _node_proc and _node_proc.stdout
        for line in _node_proc.stdout:
            print(f"[node] {line}", end="")

    import threading
    threading.Thread(target=_pump, daemon=True).start()


def _stop_node_backend() -> None:
    global _node_proc
    if not _node_proc:
        return
    try:
        _node_proc.send_signal(signal.SIGTERM)
        _node_proc.wait(timeout=10)
    except Exception:
        with contextlib.suppress(Exception):
            _node_proc.kill()
    _node_proc = None


async def _wait_for_node(timeout: float = 30.0) -> None:
    assert _http_client is not None
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        try:
            r = await _http_client.get(f"{NODE_BACKEND_URL}/api/health", timeout=2.0)
            if r.status_code == 200:
                logger.info("node backend healthy")
                return
        except Exception:
            pass
        await asyncio.sleep(0.5)
    logger.warning("node backend did not become healthy within %ss", timeout)


@app.on_event("startup")
async def _startup() -> None:
    global _http_client
    _ensure_postgres_running()
    _http_client = httpx.AsyncClient(base_url=NODE_BACKEND_URL, timeout=httpx.Timeout(60.0, connect=5.0))
    _start_node_backend()
    # Run prisma migrate / db push on first boot
    try:
        subprocess.run(
            ["npx", "prisma", "db", "push", "--accept-data-loss", "--skip-generate"],
            cwd=str(NODE_BACKEND_DIR),
            env=os.environ.copy(),
            capture_output=True,
            text=True,
            timeout=90,
        )
    except Exception as exc:
        logger.warning("prisma db push failed: %s", exc)
    await _wait_for_node()


@app.on_event("shutdown")
async def _shutdown() -> None:
    global _http_client
    _stop_node_backend()
    if _http_client:
        await _http_client.aclose()
        _http_client = None


HOP_BY_HOP = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade", "content-encoding", "content-length"}


def _filter_headers(headers) -> dict:
    return {k: v for k, v in headers.items() if k.lower() not in HOP_BY_HOP}


@app.get("/")
async def root() -> dict:
    return {"service": "krishisetu-proxy", "node_backend": NODE_BACKEND_URL}


@app.api_route("/api", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy(path: str = "", request: Request = None):  # type: ignore[assignment]
    assert _http_client is not None
    target_path = f"/api/{path}" if path else "/api/"
    url = target_path
    if request.url.query:
        url = f"{url}?{request.url.query}"

    body = await request.body()
    headers = _filter_headers(request.headers)

    try:
        req = _http_client.build_request(request.method, url, headers=headers, content=body)
        upstream = await _http_client.send(req, stream=True)
    except httpx.ConnectError:
        return Response(content='{"error":"backend unavailable"}', status_code=502, media_type="application/json")
    except Exception as exc:
        logger.exception("proxy error")
        return Response(content=f'{{"error":"proxy failure: {exc}"}}', status_code=502, media_type="application/json")

    content_type = upstream.headers.get("content-type", "")
    resp_headers = _filter_headers(upstream.headers)

    if "text/event-stream" in content_type:
        async def stream_gen():
            try:
                async for chunk in upstream.aiter_raw():
                    yield chunk
            finally:
                await upstream.aclose()
        return StreamingResponse(stream_gen(), status_code=upstream.status_code, headers=resp_headers, media_type=content_type)

    data = await upstream.aread()
    await upstream.aclose()
    return Response(content=data, status_code=upstream.status_code, headers=resp_headers, media_type=content_type)

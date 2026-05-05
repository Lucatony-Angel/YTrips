"""
Starts the backend over HTTPS using the self-signed certs in the certs/ folder.
Use this instead of plain uvicorn so the frontend (also on HTTPS) can talk to it without browser security complaints.
"""

import os
from pathlib import Path

import uvicorn


ROOT_DIR = Path(__file__).resolve().parent.parent
CERT_DIR = ROOT_DIR / "certs"
RELOAD = os.getenv("UVICORN_RELOAD", "true").lower() == "true"


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=RELOAD,
        ssl_certfile=str(CERT_DIR / "localhost.pem"),
        ssl_keyfile=str(CERT_DIR / "localhost-key.pem"),
    )

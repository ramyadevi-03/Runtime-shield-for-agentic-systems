#!/bin/sh
# spiffe-helper.sh
# Fetches SVID and trust bundle from SPIRE agent and writes to shared volume
# Runs as a sidecar container, refreshes every 60 seconds

SOCKET="/tmp/spire-agent/public/api.sock"
OUTPUT_DIR="/spiffe-certs"
SVID_PATH="$OUTPUT_DIR/svid.pem"
BUNDLE_PATH="$OUTPUT_DIR/bundle.pem"
SPIRE_AGENT_BIN="/usr/local/bin/spire-agent"

mkdir -p "$OUTPUT_DIR"

echo "[spiffe-helper] Starting SVID fetcher..."

while true; do
    if [ -S "$SOCKET" ] && [ -f "$SPIRE_AGENT_BIN" ]; then
        echo "[spiffe-helper] Fetching SVID from SPIRE agent..."

        "$SPIRE_AGENT_BIN" api fetch x509 \
            -socketPath "$SOCKET" \
            -write "$OUTPUT_DIR" 2>/tmp/spiffe-helper.log

        if [ $? -eq 0 ]; then
            [ -f "$OUTPUT_DIR/svid.0.pem" ]    && cp "$OUTPUT_DIR/svid.0.pem"   "$SVID_PATH"
            [ -f "$OUTPUT_DIR/bundle.0.pem" ]  && cp "$OUTPUT_DIR/bundle.0.pem" "$BUNDLE_PATH"
            echo "[spiffe-helper] ✅ SVID written to $OUTPUT_DIR"
        else
            echo "[spiffe-helper] ❌ Failed to fetch SVID:"
            cat /tmp/spiffe-helper.log
        fi
    else
        echo "[spiffe-helper] ⏳ Waiting for SPIRE agent socket and binary..."
    fi

    sleep 60
done
#!/bin/bash
# Install script for emr-eAPTs systemd services
# Run as root on production server

set -e

EAPTS_DIR="/opt/emr-eAPTs"
SERVICE_DIR="$(dirname "$0")"

echo "=== Installing emr-eAPTs systemd services ==="

# Create installation directory
mkdir -p "$EAPTS_DIR"
mkdir -p /var/log/eaptsLog

# Copy application files
echo "Copying application files..."
cp -r "$SERVICE_DIR"/../. "$EAPTS_DIR/"

# Copy .env if not present
if [ ! -f "$EAPTS_DIR/.env" ]; then
    cp "$SERVICE_DIR"/../.env.example "$EAPTS_DIR/.env" 2>/dev/null || true
    echo "Please configure $EAPTS_DIR/.env"
fi

# Install systemd service files
echo "Installing systemd services..."
cp "$SERVICE_DIR/emr-eapts-listener.service" /etc/systemd/system/
cp "$SERVICE_DIR/emr-eapts-dtp.service" /etc/systemd/system/
cp "$SERVICE_DIR/emr-eapts-drugsync.service" /etc/systemd/system/
cp "$SERVICE_DIR/emr-eapts-dispense.service" /etc/systemd/system/
cp "$SERVICE_DIR/emr-eapts-address.service" /etc/systemd/system/

# Install health check script
cp "$SERVICE_DIR/emr-eapts-healthcheck.sh" /opt/emr-eAPTs/
chmod +x /opt/emr-eAPTs/emr-eapts-healthcheck.sh

# Reload systemd
systemctl daemon-reload

# Enable services
systemctl enable emr-eapts-listener
systemctl enable emr-eapts-dtp
systemctl enable emr-eapts-drugsync
systemctl enable emr-eapts-dispense
systemctl enable emr-eapts-address

# Add cron job for health check (every 5 minutes)
(crontab -l 2>/dev/null | grep -v "emr-eapts-healthcheck"; echo "*/5 * * * * /opt/emr-eAPTs/emr-eapts-healthcheck.sh") | crontab -

echo "=== Installation complete ==="
echo ""
echo "Start services with:"
echo "  systemctl start emr-eapts-listener"
echo "  systemctl start emr-eapts-dtp"
echo "  systemctl start emr-eapts-drugsync"
echo "  systemctl start emr-eapts-dispense"
echo "  systemctl start emr-eapts-address"
echo ""
echo "Or start all: systemctl start emr-eapts-*"

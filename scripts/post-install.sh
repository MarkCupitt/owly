#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Owly Post-Install Script
#
# Resets the database, runs migrations, and seeds with PowerDeck defaults.
# Run from marks-desktop. Executes against the deployed Owly container on
# coolabah-server via SSH + docker exec.
#
# Usage:
#   ./scripts/post-install.sh           # Reset + seed with defaults
#   ./scripts/post-install.sh --no-reset  # Seed only (don't drop database)
#
# Environment variables (all optional, defaults shown):
#   SEED_ADMIN_USERNAME=markcupitt
#   SEED_ADMIN_PASSWORD=password1
#   SEED_ADMIN_NAME="Mark Cupitt"
#   SEED_BUSINESS_NAME="Powerdeck Solutions"
#   SEED_AI_PROVIDER=gemini
#   SEED_AI_MODEL=gemini-2.5-flash
#   SEED_AI_API_KEY=<from farm.agentic.env>
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_SCRIPT="/home/mark/repos/coolabah/powerdeck/cloud-setup/2-local-server/owly/scripts/deploy.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}  ℹ $1${NC}"; }
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
err()  { echo -e "${RED}  ✗ $1${NC}"; }

DO_RESET=true
if [[ "${1:-}" == "--no-reset" ]]; then
  DO_RESET=false
fi

# ── Load Gemini API key from farm.agentic.env ──
AGENTIC_ENV="/home/mark/repos/coolabah/powerdeck/farm.agentic.env"
if [[ -f "$AGENTIC_ENV" ]]; then
  GEMINI_KEY=$(grep -E "^GOOGLE_AI_STUDIO_API_KEY=" "$AGENTIC_ENV" | cut -d= -f2- | tr -d '[:space:]')
  export SEED_AI_API_KEY="${SEED_AI_API_KEY:-${GEMINI_KEY:-}}"
  if [[ -n "${SEED_AI_API_KEY}" ]]; then
    log "Loaded Gemini API key from farm.agentic.env"
  else
    warn "Gemini API key not found in farm.agentic.env"
  fi
else
  warn "farm.agentic.env not found — AI API key will be empty"
fi

# ── Verify deploy script exists ──
if [[ ! -f "$DEPLOY_SCRIPT" ]]; then
  err "Deploy script not found at $DEPLOY_SCRIPT"
  exit 1
fi

echo ""
echo "━━━ Owly Post-Install ━━━"

# ── Step 1: Reset database (optional) ──
if [[ "$DO_RESET" == "true" ]]; then
  log "Resetting database (dropping all data)..."

  # Drop and recreate the database via docker exec on postgres container
  ssh coolabah-server 'docker exec owly_postgres psql -U owly -d owly -c "
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO owly;
    GRANT ALL ON SCHEMA public TO public;
  "' 2>&1 | grep -v "NOTICE\|DROP SCHEMA\|CREATE SCHEMA\|GRANT" || true

  ok "Database reset complete"

  # Run migrations inside the owly container
  log "Running Prisma migrations..."
  ssh coolabah-server 'docker exec -e HOME=/tmp -w /app owly ./node_modules/.bin/prisma migrate deploy 2>&1'
  ok "Migrations applied"
else
  warn "Skipping database reset (--no-reset)"
fi

# ── Step 2: Run seed inside the container ──
log "Running seed script..."

# Pass env vars through to the container via docker exec
# Use single quotes around values to handle spaces in names
SEED_ENV="-e HOME=/tmp"
SEED_ENV+=" -e SEED_ADMIN_USERNAME='${SEED_ADMIN_USERNAME:-markcupitt}'"
SEED_ENV+=" -e SEED_ADMIN_PASSWORD='${SEED_ADMIN_PASSWORD:-password1}'"
SEED_ENV+=" -e SEED_ADMIN_NAME='${SEED_ADMIN_NAME:-Mark Cupitt}'"
SEED_ENV+=" -e SEED_BUSINESS_NAME='${SEED_BUSINESS_NAME:-Powerdeck Solutions}'"
SEED_ENV+=" -e SEED_APP_NAME='${SEED_APP_NAME:-PowerDeck HelpDesk}'"
SEED_ENV+=" -e SEED_APP_NAME_SHORT='${SEED_APP_NAME_SHORT:-PowerDeck}'"
SEED_ENV+=" -e SEED_SYSTEM_NAME='${SEED_SYSTEM_NAME:-HelpDesk}'"
SEED_ENV+=" -e SEED_AI_PROVIDER='${SEED_AI_PROVIDER:-gemini}'"
SEED_ENV+=" -e SEED_AI_MODEL='${SEED_AI_MODEL:-gemini-2.5-flash}'"
SEED_ENV+=" -e SEED_AI_API_KEY='${SEED_AI_API_KEY:-}'"
SEED_ENV+=" -e SEED_THEME_PRESET='${SEED_THEME_PRESET:-owly-default}'"
SEED_ENV+=" -e SEED_API_KEY_NAME='${SEED_API_KEY_NAME:-PowerDeck Upstream Integration}'"
SEED_ENV+=" -e SEED_UPSTREAM_SYSTEM_LABEL='${SEED_UPSTREAM_SYSTEM_LABEL:-PowerDeck Client Portal}'"
SEED_ENV+=" -e SEED_UPSTREAM_IDENTITY_ENABLED='${SEED_UPSTREAM_IDENTITY_ENABLED:-true}'"

ssh coolabah-server "docker exec ${SEED_ENV} -w /app owly npx tsx prisma/seed.ts 2>&1"

ok "Seed complete"

# ── Step 2.5: Upload PowerDeck branding assets ──
log "Uploading PowerDeck branding assets..."

BRANDING_DIR="/home/mark/repos/coolabah/powerdeck/branding"

if [[ -f "$BRANDING_DIR/powerdeck-icon.png" ]]; then
  # Uploads are bind-mounted from host dir, so copy directly to the host path
  # Directory is owned by container UID 1001, so use sudo to write
  UPLOADS_DIR="/home/mark/powerdeck/docker/owly/uploads"
  ssh coolabah-server "sudo mkdir -p $UPLOADS_DIR"

  # Copy logo and favicon (both use powerdeck-icon.png = _master_square.png)
  scp "$BRANDING_DIR/powerdeck-icon.png" coolabah-server:/tmp/pd-logo.png
  scp "$BRANDING_DIR/powerdeck-icon.png" coolabah-server:/tmp/pd-favicon.png
  ssh coolabah-server "sudo cp /tmp/pd-logo.png $UPLOADS_DIR/powerdeck-logo.png && sudo cp /tmp/pd-favicon.png $UPLOADS_DIR/powerdeck-favicon.png && sudo chown 1001:65534 $UPLOADS_DIR/powerdeck-*.png && rm /tmp/pd-logo.png /tmp/pd-favicon.png && ls -la $UPLOADS_DIR/powerdeck-*.png"
  ok "Logo + Favicon uploaded → /uploads/powerdeck-logo.png, /uploads/powerdeck-favicon.png"

  # Update global settings to use the uploaded assets (branding is global)
  ssh coolabah-server "docker exec owly_postgres psql -U owly owly -c \"UPDATE \\\"Settings\\\" SET \\\"themeLogoUrl\\\" = '/uploads/powerdeck-logo.png', \\\"themeFaviconUrl\\\" = '/uploads/powerdeck-favicon.png' WHERE id = 'default';\""
  ok "Global settings updated with PowerDeck branding"

  # Set admin user's per-user theme overrides to PowerDeck brand colors
  ADMIN_USERNAME="${SEED_ADMIN_USERNAME:-markcupitt}"
  ssh coolabah-server "cat > /tmp/pd-theme.sql << 'SQLEOF'
UPDATE \"Admin\" SET \"themePreset\" = 'owly-default',
  \"themeOverridesLight\" = '{\"--owly-primary\":\"#FF6B00\",\"--owly-primary-dark\":\"#E05A00\",\"--owly-primary-light\":\"#FF9933\",\"--owly-sidebar\":\"#222222\",\"--owly-sidebar-hover\":\"#333333\",\"--owly-sidebar-active\":\"#FF6B00\",\"--owly-text\":\"#222222\",\"--owly-text-light\":\"#555555\",\"--owly-border\":\"#DDDDDD\"}'::jsonb,
  \"themeOverridesDark\" = '{\"--owly-primary\":\"#FF6B00\",\"--owly-primary-dark\":\"#E05A00\",\"--owly-primary-light\":\"#FF9933\",\"--owly-sidebar\":\"#0F0A05\",\"--owly-sidebar-hover\":\"#1A1410\",\"--owly-sidebar-active\":\"#FF6B00\",\"--owly-text\":\"#F1F5F9\",\"--owly-text-light\":\"#94A3B8\",\"--owly-border\":\"#332B22\"}'::jsonb
  WHERE username = '${ADMIN_USERNAME}';
SQLEOF
docker exec -i owly_postgres psql -U owly owly < /tmp/pd-theme.sql && rm /tmp/pd-theme.sql"
  ok "Admin user theme set to PowerDeck brand colors"
else
  warn "Branding assets not found at $BRANDING_DIR — skipping"
fi

# ── Step 3: Restart the app to pick up fresh state ──
log "Restarting Owly container..."
ssh coolabah-server 'docker restart owly' 2>&1 | tail -1

# ── Step 4: Health check (with retries) ──
log "Health check..."
MAX_RETRIES=15
RETRY=0
HEALTH=""
while [[ $RETRY -lt $MAX_RETRIES ]]; do
  RETRY=$((RETRY + 1))
  HEALTH=$(ssh coolabah-server 'curl -sf http://127.0.0.1:3001/api/health' 2>/dev/null) || HEALTH=""
  if [[ -n "$HEALTH" ]]; then
    break
  fi
  log "Waiting for container to be ready... (attempt $RETRY/$MAX_RETRIES)"
  sleep 3
done

if [[ -z "$HEALTH" ]]; then
  err "Health check failed after $MAX_RETRIES attempts"
  exit 1
fi
echo "  $HEALTH"

echo ""
echo "━━━ Post-Install Complete ━━━"
echo ""
echo "  Admin login:  https://helpdesk"
echo "  Username:     ${SEED_ADMIN_USERNAME:-markcupitt}"
echo "  Password:     ${SEED_ADMIN_PASSWORD:-password1}"
echo ""
echo "  API base:     https://helpdesk/api"
echo "  Webhook:      https://helpdesk/api/webhooks/inbound"
echo ""
echo "  Next steps:"
echo "    1. Log in and verify settings"
echo "    2. Test API endpoints with the generated API key"
echo "    3. Send a test webhook"
echo ""

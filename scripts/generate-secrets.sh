#!/bin/bash

# Script to generate required secrets for .env.local
# Usage: ./scripts/generate-secrets.sh

set -e

echo "🔐 Generating secrets for Lumigift..."
echo ""

# Generate NEXTAUTH_SECRET
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
echo ""

# Generate CRON_SECRET
CRON_SECRET=$(openssl rand -base64 32)
echo "CRON_SECRET=$CRON_SECRET"
echo ""

echo "✅ Secrets generated successfully!"
echo ""
echo "📝 Copy these values to your .env.local file"
echo ""
echo "💡 Tip: You can also run this command directly:"
echo "   openssl rand -base64 32"

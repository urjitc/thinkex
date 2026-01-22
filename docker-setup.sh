#!/bin/bash

# ThinkEx Docker Setup Script
# This script helps set up ThinkEx for self-hosting with Docker

set -e

C1='\033[38;5;51m'   #
C2='\033[38;5;45m'  
C3='\033[38;5;39m'  
C4='\033[38;5;33m'  
C5='\033[38;5;27m'  
C6='\033[38;5;21m'  
RESET='\033[0m'

echo ""
echo -e "${C1}████████╗██╗  ██╗██╗███╗   ██╗██╗  ██╗███████╗██╗  ██╗${RESET}"
echo -e "${C2}╚══██╔══╝██║  ██║██║████╗  ██║██║ ██╔╝██╔════╝╚██╗██╔╝${RESET}"
echo -e "${C3}   ██║   ███████║██║██╔██╗ ██║█████╔╝ █████╗   ╚███╔╝ ${RESET}"
echo -e "${C4}   ██║   ██╔══██║██║██║╚██╗██║██╔═██╗ ██╔══╝   ██╔██╗ ${RESET}"
echo -e "${C5}   ██║   ██║  ██║██║██║ ╚████║██║  ██╗███████╗██╔╝ ██╗${RESET}"
echo -e "${C6}   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝${RESET}"
echo ""
echo "Docker Setup"
echo "============"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose is not installed. Please install Docker Compose first:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from docker-compose.env.example..."
    if [ -f docker-compose.env.example ]; then
        cp docker-compose.env.example .env
        echo "Created .env file"
        echo ""
        echo "IMPORTANT: Please edit .env and configure:"
        echo "   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
        echo "   - GOOGLE_GENERATIVE_AI_API_KEY"
        echo "   - Supabase credentials (if using Supabase storage)"
        echo ""
        read -p "Press Enter to continue after editing .env..."
    else
        echo "ERROR: docker-compose.env.example not found!"
        exit 1
    fi
else
    echo ".env file already exists"
fi

# Generate BETTER_AUTH_SECRET if not set
if ! grep -q "BETTER_AUTH_SECRET=.*[^=]$" .env 2>/dev/null || grep -q "BETTER_AUTH_SECRET=your-better-auth-secret" .env 2>/dev/null; then
    echo "Generating BETTER_AUTH_SECRET..."
    SECRET=$(openssl rand -base64 32)
    # Escape special characters for sed
    ESCAPED_SECRET=$(printf '%s\n' "$SECRET" | sed 's/[[\.*^$()+?{|]/\\&/g')
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - use a different delimiter (|) to avoid issues with / in base64
        sed -i '' "s|BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$SECRET|" .env
    else
        # Linux - use a different delimiter (|) to avoid issues with / in base64
        sed -i "s|BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$SECRET|" .env
    fi
    echo "Generated and set BETTER_AUTH_SECRET"
fi

echo ""
echo "Building and starting Docker containers..."
docker-compose up -d --build

echo ""
echo "Waiting for services to be ready..."
sleep 5

echo ""
echo "Creating required database roles..."
# Create the 'authenticated' role that RLS policies require (Supabase-compatible)
docker-compose exec -T postgres psql -U ${POSTGRES_USER:-thinkex} -d ${POSTGRES_DB:-thinkex} -c "CREATE ROLE authenticated;" 2>/dev/null || {
    echo "Role 'authenticated' may already exist, continuing..."
}

echo ""
echo "Running database migrations (creates functions and schema)..."
# Apply the migration SQL file using the postgres container
# Copy the SQL file to postgres container and execute it
echo "Applying migration SQL file with functions..."
CONTAINER_ID=$(docker-compose ps -q postgres 2>/dev/null)
if [ -n "$CONTAINER_ID" ] && [ -f drizzle/0000_sad_wallflower.sql ]; then
    docker cp drizzle/0000_sad_wallflower.sql $CONTAINER_ID:/tmp/migration.sql 2>/dev/null
    docker-compose exec -T postgres psql -U ${POSTGRES_USER:-thinkex} -d ${POSTGRES_DB:-thinkex} -f /tmp/migration.sql 2>&1 | grep -v "already exists" | grep -v "NOTICE" | grep -v "relation.*already exists" || {
        echo "Migration file applied (some errors about existing objects are normal)."
    }
else
    echo "Could not copy migration file, trying drizzle-kit migrate..."
    docker-compose exec -T app pnpm db:migrate 2>&1 || {
        echo "Migrations may have already been applied."
    }
fi

echo ""
echo "Pushing any remaining schema changes..."
# Use --force flag to skip interactive prompts for any remaining changes
docker-compose exec -T app pnpm exec drizzle-kit push --force 2>&1 || {
    echo ""
    echo "Schema push completed or no changes needed."
}

echo ""
echo "Setup complete!"
echo ""
echo "Access ThinkEx at: http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  - View logs:        docker-compose logs -f app"
echo "  - Stop services:    docker-compose down"
echo "  - Restart:          docker-compose restart"
echo "  - Database shell:   docker-compose exec postgres psql -U thinkex -d thinkex"
echo ""

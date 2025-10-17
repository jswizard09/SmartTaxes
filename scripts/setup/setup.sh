#!/bin/bash
# Quick Setup Script for SmartTaxes
# Run this script to quickly set up the application for development

set -e

echo "🚀 Setting up SmartTaxes..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    
    # Generate secure secrets
    SESSION_SECRET=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 32)
    
    # Update .env with generated secrets
    sed -i.bak "s/your-super-secret-session-key-change-this-in-production/$SESSION_SECRET/" .env
    sed -i.bak "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/" .env
    rm .env.bak
    
    echo "✅ Generated secure secrets for .env file"
    echo "⚠️  Please edit .env file to add your API keys (OpenAI, Stripe, etc.)"
else
    echo "✅ .env file already exists"
fi

# Create uploads directory
mkdir -p uploads
echo "✅ Created uploads directory"

# Start the application
echo "🐳 Starting Docker containers..."
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose exec app npm run db:push

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📱 Your application is now running at:"
echo "   Frontend: http://localhost:5000"
echo "   API: http://localhost:5000/api"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop app: docker-compose down"
echo "   Restart app: docker-compose restart"
echo ""
echo "📚 For more information, see DEPLOYMENT.md"

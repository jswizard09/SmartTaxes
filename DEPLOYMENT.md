# SmartTaxes Deployment Guide

## 🚀 Quick Start (Recommended for Peers)

### Prerequisites
- Docker and Docker Compose installed
- Git installed
- Basic terminal/command line knowledge

### 1. Clone and Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd SmartTaxes

# Copy environment template
cp env.example .env

# Edit .env file with your configuration
# At minimum, change the SESSION_SECRET and JWT_SECRET
```

### 2. Start the Application
```bash
# Start all services (database, redis, app)
docker-compose up -d

# Run database migrations
docker-compose exec app npm run db:push

# Check if everything is running
docker-compose ps
```

### 3. Access the Application
- **Frontend**: http://localhost:5000
- **API**: http://localhost:5000/api
- **Database**: localhost:5432 (user: smarttaxes_user, password: smarttaxes_password)

### 4. Stop the Application
```bash
# Stop all services
docker-compose down

# Stop and remove all data (WARNING: This deletes all data!)
docker-compose down -v
```

---

## 🌐 Production Deployment Options

### Option 1: Railway (Easiest - Recommended)

Railway provides automatic deployments with managed PostgreSQL.

#### Setup Steps:
1. **Create Railway Account**: Go to [railway.app](https://railway.app)
2. **Connect GitHub**: Link your repository
3. **Add PostgreSQL**: Add a PostgreSQL service
4. **Deploy**: Railway will automatically detect and deploy your app

#### Railway Configuration:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link your project
railway link

# Set environment variables
railway variables set DATABASE_URL=${{Postgres.DATABASE_URL}}
railway variables set SESSION_SECRET=your-production-session-secret
railway variables set JWT_SECRET=your-production-jwt-secret
railway variables set OPENAI_API_KEY=your-openai-key
railway variables set NODE_ENV=production

# Deploy
railway up
```

#### Railway Benefits:
- ✅ Automatic deployments from Git
- ✅ Managed PostgreSQL database
- ✅ Built-in monitoring and logs
- ✅ Custom domains
- ✅ SSL certificates
- ✅ Environment variable management

---

### Option 2: Render (Great Alternative)

Render offers similar features to Railway with excellent free tier.

#### Setup Steps:
1. **Create Render Account**: Go to [render.com](https://render.com)
2. **Create Web Service**: Connect your GitHub repo
3. **Add PostgreSQL**: Create a managed PostgreSQL database
4. **Configure Environment**: Set your environment variables

#### Render Configuration:
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Environment**: `Node`
- **Auto-Deploy**: `Yes`

#### Environment Variables for Render:
```
DATABASE_URL=<from-postgres-service>
NODE_ENV=production
SESSION_SECRET=your-production-session-secret
JWT_SECRET=your-production-jwt-secret
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
STRIPE_SECRET_KEY=your-stripe-key
```

---

### Option 3: DigitalOcean App Platform

#### Setup Steps:
1. **Create DigitalOcean Account**: Go to [digitalocean.com](https://digitalocean.com)
2. **Create App**: Choose "GitHub" as source
3. **Configure Services**: Add PostgreSQL database
4. **Deploy**: Configure and deploy

#### App Spec (app.yaml):
```yaml
name: smarttaxes
services:
- name: web
  source_dir: /
  github:
    repo: your-username/SmartTaxes
    branch: main
  run_command: npm start
  build_command: npm run build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.DATABASE_URL}
databases:
- name: db
  engine: PG
  version: "13"
```

---

### Option 4: VPS Deployment (Full Control)

For maximum control and customization.

#### Recommended VPS Providers:
- **DigitalOcean Droplets**: $5/month
- **Linode**: $5/month
- **Vultr**: $2.50/month
- **AWS EC2**: Pay-as-you-go

#### VPS Setup Script:
```bash
#!/bin/bash
# Ubuntu/Debian VPS Setup Script

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx (for reverse proxy)
sudo apt install nginx -y

# Install Certbot (for SSL)
sudo apt install certbot python3-certbot-nginx -y

# Clone your repository
git clone <your-repo-url> /opt/smarttaxes
cd /opt/smarttaxes

# Setup environment
cp env.example .env
# Edit .env with production values

# Start services
docker-compose up -d

# Setup Nginx reverse proxy
sudo tee /etc/nginx/sites-available/smarttaxes << EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/smarttaxes /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL
sudo certbot --nginx -d your-domain.com
```

---

## 🔧 Configuration Guide

### Environment Variables Explained

#### Required Variables:
```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Security (CHANGE THESE!)
SESSION_SECRET=random-string-32-chars-minimum
JWT_SECRET=another-random-string-32-chars-minimum

# Application
NODE_ENV=production
PORT=5000
```

#### Optional Variables:
```bash
# AI Services
OPENAI_API_KEY=sk-... # For document parsing and insights
ANTHROPIC_API_KEY=sk-ant-... # Alternative AI service

# Payment Processing
STRIPE_SECRET_KEY=sk_live_... # For premium subscriptions
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Upload Limits
MAX_FILE_SIZE=10485760 # 10MB
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png
```

### Database Setup

#### Initial Migration:
```bash
# Run database migrations
npm run db:push

# Or generate and run migrations
npm run db:generate
npm run db:migrate
```

#### Database Backup:
```bash
# Create backup
docker-compose exec postgres pg_dump -U smarttaxes_user smarttaxes > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U smarttaxes_user smarttaxes < backup.sql
```

---

## 📊 Monitoring and Maintenance

### Health Checks
- **Application**: `GET /api/health`
- **Database**: Check PostgreSQL connection
- **Redis**: Check Redis connection

### Logs
```bash
# View application logs
docker-compose logs -f app

# View database logs
docker-compose logs -f postgres

# View all logs
docker-compose logs -f
```

### Updates
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Run migrations if needed
docker-compose exec app npm run db:push
```

---

## 🚨 Troubleshooting

### Common Issues:

#### 1. Database Connection Failed
```bash
# Check if database is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

#### 2. Application Won't Start
```bash
# Check application logs
docker-compose logs app

# Check if port is available
netstat -tulpn | grep :5000

# Rebuild application
docker-compose up -d --build
```

#### 3. File Upload Issues
```bash
# Check uploads directory permissions
ls -la uploads/

# Fix permissions
chmod 755 uploads/
```

#### 4. Memory Issues
```bash
# Check memory usage
docker stats

# Increase memory limits in docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 1G
```

---

## 🔒 Security Checklist

### Production Security:
- [ ] Change default passwords
- [ ] Use strong session secrets
- [ ] Enable HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Regular security updates
- [ ] Database backups
- [ ] Monitor logs for suspicious activity
- [ ] Use environment variables for secrets
- [ ] Enable CORS properly
- [ ] Validate all inputs

### Environment Security:
```bash
# Generate secure secrets
openssl rand -base64 32  # For SESSION_SECRET
openssl rand -base64 32  # For JWT_SECRET
```

---

## 📈 Scaling Considerations

### Horizontal Scaling:
- Use load balancer (Nginx, HAProxy)
- Multiple app instances
- Database read replicas
- Redis cluster for sessions

### Vertical Scaling:
- Increase server resources
- Optimize database queries
- Use CDN for static assets
- Implement caching strategies

---

## 💰 Cost Estimates

### Railway:
- **Free Tier**: $0/month (limited usage)
- **Pro**: $5/month per service
- **Database**: $5/month

### Render:
- **Free Tier**: $0/month (limited usage)
- **Starter**: $7/month
- **Database**: $7/month

### DigitalOcean:
- **Droplet**: $5/month
- **Managed Database**: $15/month
- **Load Balancer**: $12/month

### VPS (Self-managed):
- **VPS**: $5-20/month
- **Domain**: $10-15/year
- **SSL**: Free (Let's Encrypt)

---

## 🎯 Recommended Path for Peers

**For quick sharing and testing**: Use **Railway** or **Render**
- Easiest setup
- Automatic deployments
- Managed database
- Free tiers available

**For production use**: Use **DigitalOcean App Platform** or **VPS**
- More control
- Better performance
- Cost-effective scaling

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review application logs
3. Check GitHub issues
4. Contact the development team

Happy deploying! 🚀

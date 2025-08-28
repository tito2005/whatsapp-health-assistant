# 🚀 Setup Guide - Multi-Sector WhatsApp AI Assistant

## Quick Setup (5 minutes)

### 1. Get GroqCloud API Key (Free)
1. Visit [console.groq.com](https://console.groq.com/)
2. Sign up for a free account
3. Create an API key
4. Copy your API key

### 2. Configure Your Assistant
```bash
# Copy environment template
cp .env.example .env

# Edit with your settings
nano .env
```

**Required Settings:**
```env
GROQ_API_KEY=your_api_key_here
BUSINESS_NAME=Your Business Name
BUSINESS_SECTOR=your_sector
```

### 3. Install and Run
```bash
# Install dependencies
pnpm install

# Setup database and start
pnpm setup:complete

# Start development server
pnpm dev
```

### 4. Connect WhatsApp
1. Open: http://localhost:3000/api/whatsapp/qr
2. Scan QR code with WhatsApp
3. Start chatting!

## 🏢 Sector Configuration Examples

### Health & Wellness
```env
BUSINESS_NAME=HealthCare Assistant
BUSINESS_SECTOR=health
AI_ROLE=health consultant
AI_PERSONALITY=caring and knowledgeable
CUSTOM_PROMPT=You provide general health advice and wellness guidance. Always recommend consulting healthcare professionals for serious medical concerns.
```

### E-commerce Store
```env
BUSINESS_NAME=Online Store Assistant
BUSINESS_SECTOR=ecommerce
AI_ROLE=sales consultant
AI_PERSONALITY=helpful and enthusiastic
CUSTOM_PROMPT=You help customers find products, answer questions about features and pricing, and guide them through the purchase process.
```

### Restaurant/Food Service
```env
BUSINESS_NAME=Restaurant Assistant
BUSINESS_SECTOR=hospitality
AI_ROLE=restaurant assistant
AI_PERSONALITY=friendly and knowledgeable about food
CUSTOM_PROMPT=You help customers with menu recommendations, dietary restrictions, reservations, and general restaurant information.
```

### Educational Institution
```env
BUSINESS_NAME=Learning Assistant
BUSINESS_SECTOR=education
AI_ROLE=educational assistant
AI_PERSONALITY=encouraging and patient
CUSTOM_PROMPT=You help students with learning guidance, course information, and study tips. Encourage active learning and provide educational support.
```

### Financial Services
```env
BUSINESS_NAME=Finance Assistant
BUSINESS_SECTOR=finance
AI_ROLE=financial advisor assistant
AI_PERSONALITY=professional and trustworthy
CUSTOM_PROMPT=You provide general financial information and guide customers to appropriate services. Always recommend consulting with licensed financial advisors for investment decisions.
```

## 🔧 Advanced Configuration

### AI Model Selection
```env
# Ultra-fast (recommended for customer service)
GROQ_MODEL=llama-3.1-8b-instant

# Balanced performance
GROQ_MODEL=llama-3.1-70b-versatile

# Maximum quality
GROQ_MODEL=llama-3.1-405b-reasoning
```

### Custom Business Logic
Add sector-specific logic in your custom prompt:

```env
CUSTOM_PROMPT=
You are a specialized assistant for [YOUR SECTOR].

Your specific responsibilities:
1. [Primary function]
2. [Secondary function]
3. [Additional services]

Important guidelines:
- [Sector-specific rule 1]
- [Sector-specific rule 2]
- [Compliance requirements]

Available services/products:
- [Service 1]: [Description]
- [Service 2]: [Description]

Contact information:
- Phone: [Your phone]
- Address: [Your address]
- Hours: [Your hours]
```

## 📊 Monitoring Your Assistant

### Health Dashboard
Visit `http://localhost:3000/health` to monitor:
- WhatsApp connection status
- Database health
- AI service connectivity
- Active conversations
- System performance

### Logs
- **Development**: Real-time console logs
- **Production**: File logs in `./logs/`
  - `error.log`: Error tracking
  - `combined.log`: All activities

## 🔒 Security Best Practices

### Environment Variables
```env
# Production settings
NODE_ENV=production
LOG_LEVEL=warn
RATE_LIMIT_MAX_REQUESTS=50

# Security
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
```

### Database Security
- SQLite with WAL mode for concurrent access
- Automatic cleanup of old conversations
- Input validation and sanitization

## 🚀 Deployment Options

### Local Development
```bash
pnpm dev  # Hot reload development server
```

### Production Server
```bash
pnpm build  # Compile TypeScript
pnpm start  # Run production server
```

### Process Manager (PM2)
```bash
npm install -g pm2
pm2 start dist/app.js --name "whatsapp-ai"
pm2 save
pm2 startup
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

## 🆘 Troubleshooting

### Common Issues

**WhatsApp won't connect:**
- Check internet connection
- Clear session: `rm -rf session/`
- Restart application

**AI responses are slow:**
- Try faster model: `GROQ_MODEL=llama-3.1-8b-instant`
- Check GroqCloud status
- Verify API key

**Database errors:**
- Check file permissions
- Ensure data directory exists
- Run: `pnpm db:setup`

### Getting Help

1. Check logs in `./logs/` directory
2. Run health check: `pnpm db:health`
3. Test WhatsApp: `pnpm whatsapp:test`
4. Open GitHub issue with logs

## 🎯 Next Steps

1. **Customize your AI**: Edit the `CUSTOM_PROMPT` in `.env`
2. **Add sector data**: Use the database to store your business information
3. **Monitor performance**: Check the health endpoint regularly
4. **Scale up**: Deploy to production when ready

Your AI assistant is now ready to serve your specific business sector! 🎉
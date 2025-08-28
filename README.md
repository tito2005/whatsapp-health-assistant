# 🤖 Multi-Sector WhatsApp AI Assistant

> Adaptable AI-powered WhatsApp assistant that can be customized for any business sector using GroqCloud's fast and cost-effective AI models.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express)](https://expressjs.com/)
[![GroqCloud](https://img.shields.io/badge/GroqCloud-FF6B35?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://www.whatsapp.com/)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)

## 🌟 Project Overview

A production-ready, sector-agnostic WhatsApp AI assistant that can be easily adapted for any business domain. Built with GroqCloud for fast, cost-effective AI responses and designed for easy customization without code changes.

### ✨ Key Features

- **🏢 Multi-Sector Support** - Easily adapt for health, e-commerce, education, finance, hospitality, or any sector
- **⚡ GroqCloud Integration** - Ultra-fast AI responses with cost-effective pricing
- **📱 WhatsApp Native** - Full WhatsApp Business API integration with QR code setup
- **🔧 Zero-Code Customization** - Configure your AI assistant through environment variables
- **💾 Persistent Conversations** - SQLite database for conversation history and data
- **🛡️ Production Ready** - Security, rate limiting, error handling, and monitoring
- **📊 Real-time Monitoring** - Health checks and performance metrics

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- GroqCloud API key ([Get one free](https://console.groq.com/))

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd whatsapp-ai-assistant

# Install dependencies with pnpm
pnpm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Configuration

Edit your `.env` file with your specific settings:

```env
# Required: Get your free API key from https://console.groq.com/
GROQ_API_KEY=your_groq_api_key_here

# Customize for your business
BUSINESS_NAME=Your Business Name
BUSINESS_SECTOR=health
AI_ROLE=health consultant
AI_PERSONALITY=caring and knowledgeable

# Optional: Add custom instructions
CUSTOM_PROMPT=You specialize in providing health advice and product recommendations...
```

### Run the Application

```bash
# Setup database and start development server
pnpm setup:complete

# Or run individually
pnpm db:setup
pnpm dev
```

### Connect WhatsApp

1. Open http://localhost:3000/api/whatsapp/qr in your browser
2. Scan the QR code with WhatsApp (Settings → Linked Devices → Link a Device)
3. Start chatting with your AI assistant!

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     WhatsApp Interface Layer                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Baileys API   │  │ Message Parser  │  │ Session Manager │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                  AI Processing Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ GroqCloud API   │  │ Conversation    │  │ Prompt Builder  │ │
│  │                 │  │ Manager         │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                     Data Layer                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ SQLite Database │  │ Conversation    │  │ Sector Data     │ │
│  │                 │  │ History         │  │ Storage         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Sector Customization

### Supported Sectors

| Sector | AI Role | Example Use Cases |
|--------|---------|-------------------|
| **Health** | Health Consultant | Symptom assessment, product recommendations, wellness advice |
| **E-commerce** | Sales Assistant | Product discovery, order processing, customer support |
| **Education** | Learning Assistant | Study guidance, course information, academic support |
| **Finance** | Financial Advisor | Account inquiries, service information, financial guidance |
| **Hospitality** | Concierge Assistant | Booking assistance, recommendations, guest services |
| **Retail** | Store Assistant | Product information, inventory checks, shopping help |
| **General** | Customer Service | Universal customer support and information |

### Easy Customization

Simply update your `.env` file:

```env
# For a Restaurant
BUSINESS_NAME=Delicious Bistro
BUSINESS_SECTOR=hospitality
AI_ROLE=restaurant assistant
AI_PERSONALITY=friendly and knowledgeable about food
CUSTOM_PROMPT=You help customers with menu recommendations, reservations, and dining inquiries. You know our menu, hours, and special offers.

# For an Online Store
BUSINESS_NAME=TechStore Pro
BUSINESS_SECTOR=ecommerce
AI_ROLE=sales consultant
AI_PERSONALITY=tech-savvy and helpful
CUSTOM_PROMPT=You assist customers with product selection, technical specifications, and order processing for electronics and gadgets.

# For a Clinic
BUSINESS_NAME=HealthCare Plus
BUSINESS_SECTOR=health
AI_ROLE=patient coordinator
AI_PERSONALITY=caring and professional
CUSTOM_PROMPT=You help patients with appointment scheduling, basic health information, and clinic services. Always recommend consulting with medical professionals for serious concerns.
```

## 🛠️ Development Commands

```bash
# Development
pnpm dev                 # Start development server with hot reload
pnpm build              # Build TypeScript to JavaScript
pnpm start              # Run production server

# Database
pnpm db:setup           # Initialize database
pnpm db:health          # Check database health

# Testing
pnpm test               # Run test suite
pnpm test:watch         # Run tests in watch mode
pnpm whatsapp:test      # Test WhatsApp connection

# Code Quality
pnpm lint               # Run ESLint
pnpm lint:fix           # Fix ESLint issues
pnpm format             # Format code with Prettier
pnpm type-check         # TypeScript type checking
```

## 🔧 Advanced Configuration

### AI Model Selection

GroqCloud offers several high-performance models:

```env
# Ultra-fast responses (recommended for customer service)
GROQ_MODEL=llama-3.1-8b-instant

# Balanced performance and quality
GROQ_MODEL=llama-3.1-70b-versatile

# Maximum quality for complex tasks
GROQ_MODEL=llama-3.1-405b-reasoning
```

### Custom Prompts by Sector

#### Health Sector
```env
CUSTOM_PROMPT=You are a knowledgeable health consultant. Provide general wellness advice, explain health conditions in simple terms, and recommend appropriate products. Always include medical disclaimers and encourage professional consultation for serious conditions.
```

#### E-commerce Sector
```env
CUSTOM_PROMPT=You are a sales expert who helps customers find the perfect products. Ask about their needs, budget, and preferences. Guide them through the ordering process and provide excellent customer service.
```

#### Education Sector
```env
CUSTOM_PROMPT=You are an educational assistant who helps students learn effectively. Provide study tips, explain concepts clearly, and guide students to appropriate resources. Encourage active learning and critical thinking.
```

## 📊 Monitoring & Analytics

### Health Check Endpoint

Visit `http://localhost:3000/health` to see:

- WhatsApp connection status
- Database health
- AI service connectivity
- Overall system status
- Performance metrics

### Logs

- **Development**: Console output with pretty formatting
- **Production**: File-based logging in `./logs/`
- **Error Tracking**: Automatic error categorization and alerting

## 🔐 Security Features

- **Rate Limiting**: Prevents API abuse
- **Input Validation**: Sanitizes all user inputs
- **Error Handling**: Graceful error recovery
- **Data Protection**: Secure conversation storage
- **CORS Protection**: Configurable cross-origin policies

## 🌐 Deployment

### Environment Setup

```bash
# Production environment
NODE_ENV=production
PORT=3000

# Required for production
GROQ_API_KEY=your_production_api_key
DATABASE_PATH=/app/data/assistant.db
LOG_LEVEL=warn
```

### Docker Deployment (Optional)

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check this README and code comments
- **Issues**: Open a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas

## 🎉 Success Stories

This assistant framework has been successfully adapted for:

- **Healthcare**: Patient consultations and product recommendations
- **E-commerce**: Customer support and sales automation  
- **Education**: Student guidance and learning support
- **Hospitality**: Guest services and booking assistance

---

**Ready to build your AI assistant?** Start by customizing your `.env` file and running `pnpm setup:complete`!
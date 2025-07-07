# WhatsApp Health Assistant - Project Context

## Project Overview
AI-powered WhatsApp health consultation bot for Indonesian market, handling health product recommendations and order processing.

## Key Project-Specific Context

### Domain Requirements
- **Health Consultations**: AI-powered health advice in Indonesian language
- **Product Catalog**: Health supplements with regulatory compliance
- **Order Processing**: COD, bank transfer, e-wallet integration
- **Indonesian Market**: Local business practices, Bahasa Indonesia interactions

### Technical Architecture
- **WhatsApp Integration**: @whiskeysockets/baileys for WhatsApp Web
- **AI Integration**: Claude API for health consultations
- **State Management**: Redis for conversation persistence
- **Database**: SQLite with WAL mode for product/order data
- **Real-time Processing**: Event-driven message handling

### Business Logic Patterns
- **Conversation Flow**: Health consultation → Product recommendation → Order processing
- **Error Isolation**: WhatsApp can work without Claude, database is critical
- **Graceful Degradation**: Service failures handled without breaking user experience
- **Indonesian Language**: Health consultant persona configured for local market

### Integration Points
- **WhatsApp ↔ Claude**: Message routing and response handling
- **Claude ↔ Database**: Product queries and order processing
- **Redis ↔ ConversationManager**: Session state persistence
- **Express API**: Health checks and webhook endpoints

### Critical Success Factors
- **Message Reliability**: WhatsApp messages must be processed and responded to
- **Conversation Context**: User context preserved across sessions
- **Product Accuracy**: Health product recommendations must be accurate
- **Order Integrity**: Payment and delivery information must be secure

---
*Project-specific context only - see ~/CLAUDE.md for global standards*
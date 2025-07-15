# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note**: This is a development assistance file for Claude Code IDE integration. It contains technical documentation and development workflows for the WhatsApp Health Assistant project.

## Development Commands

### Core Development
- `yarn dev` - Start development server with hot reload using nodemon and ts-node
- `yarn build` - Compile TypeScript to JavaScript in dist/ directory
- `yarn start` - Run production server from compiled dist/app.js
- `yarn type-check` - Run TypeScript type checking without compilation
- `yarn lint` - Run ESLint on all TypeScript files
- `yarn lint:fix` - Run ESLint with automatic fixes
- `yarn format` - Format code with Prettier

### Testing
- `yarn test` - Run Jest test suite
- `yarn test:watch` - Run tests in watch mode
- `yarn test:coverage` - Generate test coverage report

### Database Management
- `yarn db:setup:isolated` - Set up database in isolated mode (recommended)
- `yarn db:health:isolated` - Check database health in isolated mode
- `yarn db:seed:safe` - Seed database with products safely
- `yarn db:summary:isolated` - Show database summary
- `yarn products:validate` - Validate product data
- `yarn products:summary` - Show products summary

### WhatsApp Testing
- `yarn whatsapp:test` - Test WhatsApp connection
- `yarn whatsapp:test:network` - Test network connectivity for WhatsApp
- `yarn whatsapp:test:full` - Full WhatsApp connection test

### Setup Commands
- `yarn setup:complete` - Complete setup: install, database, health check
- `yarn setup:dev` - Development setup: install, database, type-check, lint

## Architecture Overview

### Core Services Architecture
The application follows a layered service architecture with clear separation of concerns:

1. **WhatsApp Layer** (`src/whatsapp/`)
   - `WhatsAppService`: Main orchestrator for WhatsApp operations
   - `BaileysClient`: WhatsApp Web client using @whiskeysockets/baileys
   - `EnhancedWhatsAppService`: Extended functionality for message handling

2. **AI Integration Layer** (`src/claude/`)
   - `ClaudeService`: Anthropic Claude AI integration for health consultations
   - `ConversationManager`: Manages conversation state and context persistence
   - Health consultant persona configured for Indonesian language interactions

3. **Data Layer**
   - **Database**: SQLite with connection pooling (`src/config/database.ts`)
   - **Products**: Health product catalog management (`src/products/`)
   - **Redis**: Session state and conversation context caching

4. **Express API Layer** (`src/app.ts`)
   - Health check endpoint with service status monitoring
   - WhatsApp webhook routes
   - Security middleware (helmet, CORS, rate limiting)
   - Graceful shutdown handling

### Key Design Patterns

- **Service Orchestration**: WhatsAppService coordinates between Baileys client and Claude AI
- **State Management**: Redis-based conversation persistence with ConversationManager
- **Error Isolation**: Services can fail independently (WhatsApp can work without Claude, database is critical)
- **Type Safety**: Comprehensive TypeScript types in `src/types/` for all domain objects
- **Path Aliases**: Import paths use `@/` prefix (configured in tsconfig.json)

### Configuration Management
- Environment-based configuration in `src/config/environment.ts`
- Required environment variables: `CLAUDE_API_KEY`
- Database path defaults to `./data/chatbot.db`
- WhatsApp session stored in `./session/` directory

### Message Flow
1. WhatsApp message received via Baileys client
2. Message parsed and validated in WhatsAppService
3. Conversation context retrieved from ConversationManager
4. Claude AI processes message with health consultant persona
5. Response sent back through WhatsApp
6. Conversation state updated and persisted

### Database Schema
- SQLite database with products, customers, orders, and conversations tables
- Foreign key constraints enabled
- WAL mode for better concurrent access
- Automatic backup and health monitoring

### Testing Strategy
- Jest with ts-jest for TypeScript support
- Test setup in `tests/setup.ts`
- Unit tests focus on service layer logic
- Mock WhatsApp and Claude services for isolated testing

### Deployment Considerations
- Graceful shutdown handling for SIGTERM/SIGINT
- Health check endpoint reports service status
- Database-first initialization (critical for operations)
- WhatsApp service can fail without breaking core functionality
- Comprehensive logging with Pino logger
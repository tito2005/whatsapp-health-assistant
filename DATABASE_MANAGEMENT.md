# Database Management Guide

This guide explains how to manage the SQLite database and update products with new prices and data.

## Database Location

The database is located at: `./data/chatbot.db`

## Available Commands

### Product Management

#### Check Current Product Count
```bash
yarn db:count
```
Shows how many products are currently in the database.

#### Update Products with New Prices
```bash
# Option 1: Safe reset (clears products only, keeps customers/orders)
yarn products:update

# Option 2: Force update (overwrites existing products)
yarn products:force
```

#### Validate Product Data
```bash
yarn products:validate
```
Validates all product data before seeding.

#### Show Product Summary
```bash
yarn products:summary
```
Displays a summary of all products in the database.

### Database Reset Options

#### 1. Clear Products Only (Recommended)
```bash
yarn db:reset:products
```
- Clears only products and product recommendations
- Keeps customers, orders, and conversations
- **Safest option for updating products**

#### 2. Clear All Data
```bash
yarn db:reset:all
```
- Clears all data but keeps database structure
- Removes customers, orders, conversations, and products
- Use when you want a fresh start

#### 3. Full Database Reset
```bash
yarn db:reset:full
```
- Completely deletes the database file
- Forces complete recreation on next startup
- **Use with extreme caution**

### Database Backup

#### Create Backup
```bash
yarn db:backup
```
Creates a timestamped backup in `./data/backups/`

### Database Health Check

#### Check Database Status
```bash
yarn db:health:isolated
yarn db:summary:isolated
```

## Recommended Workflow for Updating Products

### Safe Product Update (Recommended)
```bash
# 1. Check current state
yarn db:count
yarn products:summary

# 2. Create backup (optional but recommended)
yarn db:backup

# 3. Update products
yarn products:update

# 4. Verify update
yarn products:summary
```

### Alternative: Force Update without Reset
```bash
# If you want to overwrite existing products without clearing
yarn products:force
```

## Common Scenarios

### Scenario 1: Update Product Prices
You have new prices from `seed-products.ts` and want to update the database.

```bash
yarn products:update
```

### Scenario 2: Add New Products
You have new products in `seed-products.ts` and existing products should remain.

```bash
yarn products:force
```

### Scenario 3: Complete Fresh Start
You want to clear everything and start over.

```bash
# Create backup first
yarn db:backup

# Full reset
yarn db:reset:full

# Setup database
yarn db:setup:isolated
```

### Scenario 4: Fix Corrupted Database
If the database becomes corrupted or has issues.

```bash
# Backup if possible
yarn db:backup

# Full reset and recreate
yarn db:reset:full
yarn db:setup:isolated
```

## Product Data Structure

Products are stored with the following key fields:
- `name`: Product name
- `price`: Current price
- `discountPrice`: Bundle/discount price
- `category`: Product category
- `benefits`: Array of benefits
- `ingredients`: Array of ingredients
- `healthConditions`: Health conditions it addresses
- `symptoms`: Symptoms it helps with
- `metadata`: Additional product data

## Troubleshooting

### Database Locked Error
If you get "database is locked" errors:
```bash
# Stop any running processes
# Then reset
yarn db:reset:full
yarn db:setup:isolated
```

### Products Not Updating
If products aren't updating with new data:
```bash
# Clear products specifically
yarn db:reset:products

# Then seed new data
yarn db:seed:safe
```

### Check What's in Database
```bash
# See product count
yarn db:count

# See product details
yarn products:summary

# Full database health
yarn db:health:isolated
```

## File Locations

- **Database**: `./data/chatbot.db`
- **Backups**: `./data/backups/`
- **Product Data**: `./scripts/seed-products.ts`
- **Reset Tool**: `./scripts/reset-database.ts`

## Security Notes

- Always backup before major operations
- The `db:reset:full` command is destructive
- Product updates are safe and won't affect customer data
- Database backups include all customer information

## Summary

For most product updates, use:
```bash
yarn products:update
```

This safely clears products and reseeds with new data while preserving customer information.
# Quick Start Guide

## Setup in 5 Minutes

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Database
Create `.env` file (or use existing):
```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=anaqat_iraq
```

### 3. Seed the Database
```bash
npm run seed
```

This creates:
- Demo store: "متجر الأناقة"
- 4 test users (all with password: `demo123`)
- 13 clothing categories
- 5 sample items with stock

### 4. Start Development Server
```bash
npm run start:dev
```

Server runs on: `http://localhost:3000/api/v1`

## Test the API

### Login as Owner
```bash
curl -X POST "http://localhost:3000/api/v1/auth/login?storeId=<STORE_ID>" \
  -H "Content-Type: application/json" \
  -d '{"username":"owner","password":"demo123"}'
```

You'll get a response like:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "...",
    "username": "owner",
    "role": "OWNER"
  }
}
```

### Copy the Token
Use the `access_token` value for all subsequent requests.

### List Stores
```bash
curl -X GET "http://localhost:3000/api/v1/stores" \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### List Inventory Items
```bash
curl -X GET "http://localhost:3000/api/v1/inventory/items" \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Create a Sale
```bash
curl -X POST "http://localhost:3000/api/v1/sales" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "notes": "test sale",
    "lines": [
      {
        "clothingItemId": "ITEM_ID",
        "size": "M",
        "quantity": 1,
        "unitPrice": 50000
      }
    ]
  }'
```

## Key API Paths

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login?storeId=<id>` | Login |
| POST | `/auth/register` | Register new user |
| GET | `/stores` | List stores |
| GET | `/inventory/items` | List items |
| POST | `/inventory/items` | Create item |
| POST | `/sales` | Create sale |
| GET | `/sales` | List sales |

## Database Schema Quick Reference

```
Store
├── Users
├── ClothingItems
│   └── SizeStock (variants)
├── Sales
│   └── SaleLines
└── CustomerSessions
    └── OutfitRecommendations
```

## User Roles & Permissions

| Role | Permissions |
|------|-------------|
| OWNER | Everything |
| MANAGER | Users, sales, reports |
| SALES_STAFF | Create sales, customer sessions |
| INVENTORY_STAFF | Manage items, sizes, stock |

## Common Tasks

### Create a New Clothing Item
```javascript
POST /inventory/items
{
  "categoryId": "...",
  "primaryColor": "أسود",
  "secondaryColor": "ذهبي",
  "audienceTag": "WOMEN",
  "price": 150000,
  "sizes": [
    { "size": "S", "quantity": 10 },
    { "size": "M", "quantity": 15 }
  ]
}
```

### Add New User
```javascript
POST /users
{
  "username": "newuser",
  "password": "secure123",
  "fullName": "الاسم الكامل",
  "role": "SALES_STAFF"
}
```

### Record a Sale
```javascript
POST /sales
{
  "userId": "...",
  "notes": "عميل جديد",
  "lines": [
    {
      "clothingItemId": "...",
      "size": "M",
      "quantity": 2,
      "unitPrice": 50000
    }
  ]
}
```

### Get Sales Report
```javascript
GET /sales/report/summary?startDate=2024-01-01&endDate=2024-12-31
```

## Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check DB_HOST, DB_PORT, credentials in .env
- Ensure database `anaqat_iraq` exists

### Port 3000 Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run start:dev
```

### JWT Token Expired
- Get a new token by logging in again
- Default expiration is 24 hours

### 401 Unauthorized
- Ensure Authorization header has correct format: `Bearer <token>`
- Verify token is not expired
- Check that user account is active

## Next Steps

1. Read `README.md` for full API documentation
2. Check `ARCHITECTURE.md` for design details
3. Update `.env` with production credentials before deploying
4. Create frontend integration tests
5. Set up monitoring and error tracking

## Support

For issues or questions, check:
- `README.md` - Full API reference
- `ARCHITECTURE.md` - System design
- Source code comments - Implementation details
- TypeORM docs - Database operations
- NestJS docs - Framework details

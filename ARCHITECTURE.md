# Anaqat Al-Iraq Backend Architecture

## Overview

The backend is built with NestJS and PostgreSQL, implementing a modular, role-based system for managing Iraqi clothing store inventory and sales.

## Core Principles

- **Store-Scoped**: All data is isolated by store, enabling multi-tenant operations
- **Role-Based Access Control**: Fine-grained permissions via Passport JWT + RolesGuard
- **Type Safety**: Full TypeScript with strict mode enabled
- **Database First**: TypeORM entities define schema with automatic migrations

## Modules

### Auth Module (`src/modules/auth/`)

Handles user authentication and authorization.

**Key Files:**
- `auth.service.ts` - Login/register logic, password hashing with bcrypt
- `auth.controller.ts` - POST /auth/login, POST /auth/register
- `jwt.strategy.ts` - Passport JWT strategy
- `jwt-auth.guard.ts` - Authentication guard for protected routes
- `roles.guard.ts` - Authorization guard for role-based access
- `roles.decorator.ts` - @Roles(...) decorator for route protection

**JWT Payload:**
```typescript
{
  userId: string;
  storeId: string;
  username: string;
  role: UserRole;
}
```

**User Roles:**
- `OWNER` - Full store access
- `MANAGER` - User and operational management
- `SALES_STAFF` - Process sales, manage customer sessions
- `INVENTORY_STAFF` - Manage items and stock

### Users Module (`src/modules/users/`)

CRUD operations for store staff.

**Endpoints:**
- `GET /users` - List all users in store
- `GET /users/:id` - Get user by ID
- `POST /users` - Create user (Manager/Owner only)
- `PATCH /users/:id` - Update user (Manager/Owner only)
- `DELETE /users/:id` - Delete user (Owner only)

**Services:**
- User creation with hashed passwords
- Password change functionality
- Username uniqueness per store
- User activation/deactivation

### Store Module (`src/modules/store/`)

Store management.

**Endpoints:**
- `GET /stores` - List all stores
- `POST /stores` - Create store
- `GET /stores/:id` - Get store details
- `PATCH /stores/:id` - Update store (Owner only)
- `DELETE /stores/:id` - Delete store (Owner only)

**Features:**
- Store metadata (name, address, phone)
- Active/inactive status
- Timestamps (createdAt, updatedAt)

### Inventory Module (`src/modules/inventory/`)

Clothing item and stock management.

**Endpoints:**
- `POST /inventory/items` - Create item with sizes
- `GET /inventory/items` - List items (with filtering)
- `GET /inventory/items/search?q=term` - Search by color, style
- `GET /inventory/items/:id` - Get item details
- `PATCH /inventory/items/:id` - Update item
- `DELETE /inventory/items/:id` - Delete item
- `POST /inventory/items/:id/sizes` - Add size variant
- `PATCH /inventory/items/:id/sizes/:size` - Update stock quantity
- `POST /inventory/items/:id/reduce-stock` - Reduce on sale
- `DELETE /inventory/items/:id/sizes/:size` - Remove size
- `GET /inventory/stock/total` - Total store stock quantity

**Features:**
- Category-based organization (Shirt, Abaya, Jeans, etc.)
- Color tracking (primary, secondary, family)
- Audience targeting (Men, Women, Unisex)
- Style tagging (Formal, Casual, Traditional)
- Size/quantity management with constraints
- Stock reduction validation
- Search by color family and style

**Data Structure:**
```typescript
ClothingItem {
  id: UUID
  store: Store
  category: ClothingCategory
  primaryColor: string
  secondaryColor?: string
  colorFamily?: string
  styleTag?: string
  audienceTag: 'MEN' | 'WOMEN' | 'UNISEX'
  price?: decimal
  imageUrl?: string
  isActive: boolean
  sizes: SizeStock[] // eager loaded
  createdAt, updatedAt
}

SizeStock {
  id: UUID
  clothingItem: ClothingItem
  size: string ('XS', 'S', 'M', 'L', 'XL', '36', '38', '40', '42', '44')
  quantity: integer
}
```

### Sales Module (`src/modules/sales/`)

Transaction and revenue management.

**Endpoints:**
- `POST /sales` - Create sale (atomically reduces stock)
- `GET /sales` - List all sales (paginated)
- `GET /sales/:id` - Get sale details with line items
- `GET /sales/user/:userId` - Get user's sales
- `GET /sales/report/summary?startDate=&endDate=` - Sales metrics

**Features:**
- Atomic sale creation with stock validation
- Insufficient stock detection
- Total amount calculation
- Sales reporting (total amount, item count, average)
- Date range filtering
- Pagination support

**Data Structure:**
```typescript
Sale {
  id: UUID
  store: Store
  user: User
  totalAmount: decimal
  notes?: text
  lines: SaleLine[] // eager loaded
  createdAt
}

SaleLine {
  id: UUID
  sale: Sale
  clothingItem: ClothingItem
  size: string
  quantity: integer
  unitPrice?: decimal
}
```

## Database Schema

### Entities Overview

```
Store (1) ----> (many) User
              ----> (many) ClothingItem
              ----> (many) Sale
              ----> (many) CustomerSession
              ----> (many) AiProcessingJob
              ----> (many) AuditLog

ClothingCategory (1) ----> (many) ClothingItem
                        ----> (many) ClothingCategory (self-referencing)

ClothingItem (1) ----> (many) SizeStock
                   ----> (many) SaleLine
                   ----> (many) OutfitRecommendationItem

Sale (1) ----> (many) SaleLine

CustomerSession (1) ----> (many) OutfitRecommendation

OutfitRecommendation (1) ----> (many) OutfitRecommendationItem
```

### Clothing Categories (Seed Data)

Arabic/English pairs:
- قميص / Shirt
- بنطلون / Trousers
- جاكيت / Jacket
- فستان / Dress
- عباية / Abaya
- تيشيرت / T-Shirt
- جينز / Jeans
- تنورة / Skirt
- هودي / Hoodie
- سويتر / Sweater
- معطف / Coat
- بدلة / Suit
- بولو / Polo

## Authentication Flow

1. User logs in via `POST /auth/login?storeId=<store-id>` with username/password
2. Backend validates credentials (store-scoped)
3. JWT token generated with user context
4. Client includes token: `Authorization: Bearer <token>`
5. JwtAuthGuard validates token on protected routes
6. RolesGuard checks required role against user.role

## Request/Response Examples

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login?storeId=<store-id> \
  -H "Content-Type: application/json" \
  -d '{"username":"owner","password":"demo123"}'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "username": "owner",
    "fullName": "مالك المتجر",
    "role": "OWNER",
    "storeId": "store-uuid"
  }
}
```

### Create Clothing Item
```bash
curl -X POST http://localhost:3000/api/v1/inventory/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": "category-uuid",
    "primaryColor": "أسود",
    "secondaryColor": "ذهبي",
    "colorFamily": "محايد",
    "styleTag": "تقليدي",
    "audienceTag": "WOMEN",
    "price": 150000,
    "sizes": [
      {"size": "S", "quantity": 10},
      {"size": "M", "quantity": 15},
      {"size": "L", "quantity": 12}
    ]
  }'
```

### Create Sale
```bash
curl -X POST http://localhost:3000/api/v1/sales \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "notes": "بيع شخصي",
    "lines": [
      {
        "clothingItemId": "item-uuid",
        "size": "M",
        "quantity": 2,
        "unitPrice": 50000
      }
    ]
  }'
```

## Key Design Decisions

### Store-Scoped Data Isolation
- Foreign key `storeId` on all relevant entities
- Queries always filter by `storeId` from JWT
- Prevents data leakage between store tenants

### Eager Loading
- ClothingItem.sizes loaded eagerly for most queries
- Sale.lines loaded eagerly for completeness
- OutfitRecommendation.items loaded eagerly

### Soft/Hard Deletes
- ClothingItem, User, Store use `isActive` boolean (soft delete compatible)
- SizeStock, SaleLine use hard delete (transactional integrity)

### Stock Management
- Unique constraint on `(clothingItemId, size)` pair
- Stock reduction validated before sale creation
- Atomic transaction prevents race conditions

### Timestamps
- `createdAt` for all entities (immutable)
- `updatedAt` for mutable entities (Store, User, ClothingItem)
- No `updatedAt` on historical records (Sale, SaleLine, AuditLog)

## Future Enhancements

### AI Features (Placeholder Entities)
- **AiProcessingJob**: Queue system for image analysis
  - Color detection from photos
  - Clothing classification
  - Voice parsing for orders
  - Outfit recommendations

- **CustomerSession**: Customer interaction tracking
  - Customer photo for styling
  - Notes from staff
  - Recommended outfits

- **OutfitRecommendation**: AI-generated combos
  - 4-rank recommendation system
  - Item combinations
  - Reasoning in Arabic/English

### Audit System
- **AuditLog**: Track all user actions
  - Action type (CREATE, UPDATE, DELETE)
  - Entity type and ID
  - JSON details of changes
  - User and timestamp

## Performance Considerations

### Indexes
- Store ID + status on ClothingItem (common filter)
- Store ID + createdAt on Sale (pagination)
- Store ID + status on inventory items
- Clothing item + size unique index for stock integrity

### Query Optimization
- Pagination on sales listing
- Search uses ILIKE with pattern matching
- Category filtering before detailed queries
- Relations loaded with `leftJoinAndSelect` where needed

### Caching Opportunities (Future)
- Category list (rarely changes)
- Store metadata
- User role/permissions
- Total stock calculations

## Testing Strategy (Framework Ready)

Current modules support:
- Service unit tests with mocked repositories
- Controller integration tests with test fixtures
- E2E tests with seeded test database
- JWT token generation for auth tests

## Deployment Checklist

- [ ] Update JWT_SECRET in production .env
- [ ] Configure DB_HOST, DB_PASSWORD, DB_DATABASE
- [ ] Set NODE_ENV=production
- [ ] Configure CORS_ORIGIN for frontend domain
- [ ] Disable database logging
- [ ] Set synchronize=false in TypeORM
- [ ] Create first store and owner user
- [ ] Enable SSL for database connection
- [ ] Set up backups
- [ ] Configure monitoring/logging

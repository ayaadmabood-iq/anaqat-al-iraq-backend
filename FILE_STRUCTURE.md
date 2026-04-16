# Backend File Structure

Complete NestJS backend for Anaqat Al-Iraq with PostgreSQL database.

## Project Layout

```
backend/
├── src/
│   ├── config/
│   │   └── database.config.ts              # TypeORM configuration
│   ├── database/
│   │   ├── entities/                       # TypeORM entity definitions
│   │   │   ├── store.entity.ts            # Store with users, items, sales
│   │   │   ├── user.entity.ts             # Staff users with roles
│   │   │   ├── clothing-category.entity.ts # Categories (self-referencing)
│   │   │   ├── clothing-item.entity.ts    # Clothing items with colors/styles
│   │   │   ├── size-stock.entity.ts       # Size variants and quantities
│   │   │   ├── sale.entity.ts             # Sales transactions
│   │   │   ├── sale-line.entity.ts        # Individual sale items
│   │   │   ├── customer-session.entity.ts # Customer interaction sessions
│   │   │   ├── outfit-recommendation.entity.ts # AI outfit recommendations
│   │   │   ├── outfit-recommendation-item.entity.ts # Items in recommendations
│   │   │   ├── ai-processing-job.entity.ts # Background AI task queue
│   │   │   └── audit-log.entity.ts        # Action audit trail
│   │   ├── index.ts                       # Entity exports
│   │   └── seed.ts                        # Database seeding script
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts           # Login validation
│   │   │   │   └── register.dto.ts        # Registration validation
│   │   │   ├── auth.controller.ts         # POST /auth/login, /register
│   │   │   ├── auth.service.ts            # Login/register logic
│   │   │   ├── auth.module.ts             # Auth module definition
│   │   │   ├── jwt.strategy.ts            # Passport JWT strategy
│   │   │   ├── jwt-auth.guard.ts          # JWT authentication guard
│   │   │   ├── roles.guard.ts             # Role-based access control
│   │   │   └── roles.decorator.ts         # @Roles() decorator
│   │   ├── users/
│   │   │   ├── users.controller.ts        # User CRUD endpoints
│   │   │   ├── users.service.ts           # User operations
│   │   │   └── users.module.ts            # Users module definition
│   │   ├── store/
│   │   │   ├── store.controller.ts        # Store endpoints
│   │   │   ├── store.service.ts           # Store operations
│   │   │   └── store.module.ts            # Store module definition
│   │   ├── inventory/
│   │   │   ├── dto/
│   │   │   │   ├── create-item.dto.ts     # Item creation validation
│   │   │   │   ├── update-item.dto.ts     # Item update validation
│   │   │   │   └── reduce-stock.dto.ts    # Stock reduction validation
│   │   │   ├── inventory.controller.ts    # Inventory endpoints
│   │   │   ├── inventory.service.ts       # Item and stock operations
│   │   │   └── inventory.module.ts        # Inventory module definition
│   │   ├── sales/
│   │   │   ├── dto/
│   │   │   │   └── create-sale.dto.ts     # Sale validation
│   │   │   ├── sales.controller.ts        # Sales endpoints
│   │   │   ├── sales.service.ts           # Sale and reporting operations
│   │   │   └── sales.module.ts            # Sales module definition
│   │   └── index.ts                       # Module exports
│   ├── app.module.ts                      # Root application module
│   └── main.ts                            # Application bootstrap
├── .env                                   # Environment variables (local)
├── .env.example                           # Environment template
├── .gitignore                             # Git ignore rules
├── nest-cli.json                          # NestJS CLI configuration
├── tsconfig.json                          # TypeScript configuration
├── package.json                           # Dependencies and scripts
├── README.md                              # Full API documentation
├── ARCHITECTURE.md                        # System design and patterns
├── QUICK_START.md                         # 5-minute setup guide
└── FILE_STRUCTURE.md                      # This file
```

## File Descriptions

### Core Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Application entry point, NestJS bootstrap |
| `src/app.module.ts` | Root module importing all feature modules |
| `package.json` | Dependencies, scripts, project metadata |
| `tsconfig.json` | TypeScript strict mode configuration |
| `nest-cli.json` | NestJS code generation settings |

### Database Layer

| File | Purpose |
|------|---------|
| `src/config/database.config.ts` | TypeORM PostgreSQL configuration |
| `src/database/entities/*.ts` | TypeORM entity definitions (14 entities) |
| `src/database/index.ts` | Export all entities for cleaner imports |
| `src/database/seed.ts` | Demo data: store, users, categories, items |

### Auth Module (`src/modules/auth/`)

- `auth.controller.ts` - Routes: POST /auth/login, /auth/register
- `auth.service.ts` - Password hashing, JWT generation, validation
- `jwt.strategy.ts` - Passport strategy for JWT extraction/validation
- `jwt-auth.guard.ts` - Applies JWT authentication
- `roles.guard.ts` - Checks user.role against @Roles() decorator
- `roles.decorator.ts` - Marks routes with required roles
- `dto/*.ts` - Validation classes for request bodies

### Users Module (`src/modules/users/`)

- `users.controller.ts` - Routes: GET/POST/PATCH/DELETE /users
- `users.service.ts` - CRUD operations, password management
- `users.module.ts` - Module configuration with TypeORM

### Store Module (`src/modules/store/`)

- `store.controller.ts` - Routes: GET/POST/PATCH/DELETE /stores
- `store.service.ts` - Store CRUD and validation
- `store.module.ts` - Module configuration

### Inventory Module (`src/modules/inventory/`)

- `inventory.controller.ts` - Routes: GET/POST/PATCH/DELETE /inventory/items and sizes
- `inventory.service.ts` - Item/size management, stock operations
- `dto/*.ts` - Validation: CreateItemDto, UpdateItemDto, ReduceStockDto
- `inventory.module.ts` - Module with TypeORM repositories

### Sales Module (`src/modules/sales/`)

- `sales.controller.ts` - Routes: GET/POST /sales, /sales/:id, reports
- `sales.service.ts` - Sale creation (atomic stock reduction), reporting
- `dto/create-sale.dto.ts` - Sale validation with line items
- `sales.module.ts` - Module configuration

### Documentation

| File | Content |
|------|---------|
| `README.md` | Full API reference, setup, endpoints |
| `ARCHITECTURE.md` | Design patterns, database schema, flow diagrams |
| `QUICK_START.md` | 5-minute setup and basic API testing |
| `FILE_STRUCTURE.md` | This file - directory and file descriptions |

### Configuration

| File | Purpose |
|------|---------|
| `.env` | Local environment variables (git-ignored) |
| `.env.example` | Template for environment setup |
| `.gitignore` | Exclude node_modules, .env, dist/, etc. |

## Entity Count

**14 Total Entities:**
1. Store
2. User
3. ClothingCategory
4. ClothingItem
5. SizeStock
6. Sale
7. SaleLine
8. CustomerSession
9. OutfitRecommendation
10. OutfitRecommendationItem
11. AiProcessingJob
12. AuditLog

## Module Structure

```
AppModule
├── AuthModule
│   ├── JwtAuthGuard
│   ├── RolesGuard
│   └── AuthService
├── UsersModule
│   └── UsersService
├── StoreModule
│   └── StoreService
├── InventoryModule
│   └── InventoryService
└── SalesModule
    └── SalesService
```

## Key Features

✓ **Authentication**: JWT-based with Passport strategy
✓ **Authorization**: Role-based access control (@Roles guard)
✓ **Database**: TypeORM with PostgreSQL, automatic schema sync
✓ **Validation**: Class-validator DTOs on all endpoints
✓ **Store Isolation**: Multi-tenant architecture via storeId
✓ **Stock Management**: Atomic transactions, quantity validation
✓ **Sales Reporting**: Totals, averages, date filtering
✓ **Seeding**: Demo data with 4 users and 5 items
✓ **Error Handling**: Proper HTTP status codes and messages
✓ **Type Safety**: Full TypeScript, strict mode enabled

## Installation & Execution

```bash
# Install dependencies
npm install

# Seed demo database
npm run seed

# Development (watch mode)
npm run start:dev

# Production build and run
npm run build
npm run start:prod

# Database operations
npm run typeorm                 # Run TypeORM CLI
npm run migration:generate     # Create migration
npm run migration:run          # Run migrations
npm run migration:revert       # Revert last migration
```

## Testing Checklist

After starting the server:

1. [ ] Login: `POST /auth/login?storeId=<id>` with demo credentials
2. [ ] Get token from response and use in Authorization header
3. [ ] List stores: `GET /stores`
4. [ ] Create item: `POST /inventory/items` with category and sizes
5. [ ] Search items: `GET /inventory/items/search?q=<color>`
6. [ ] Create sale: `POST /sales` with line items
7. [ ] Get report: `GET /sales/report/summary`
8. [ ] Test role protection: Try sales endpoint as inventory user (should fail)

## Code Patterns

### Service Structure
```typescript
@Injectable()
export class XxxService {
  constructor(
    @InjectRepository(Entity)
    private repository: Repository<Entity>,
  ) {}

  async create(data): Promise<Entity> { ... }
  async getById(id, storeId): Promise<Entity> { ... }
  async update(id, storeId, data): Promise<Entity> { ... }
  async delete(id, storeId): Promise<void> { ... }
}
```

### Controller Structure
```typescript
@Controller('path')
@UseGuards(JwtAuthGuard)
export class XxxController {
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async create(@Body() dto: CreateDto) {
    const storeId = 'stub'; // Get from request.user
    return this.service.create(storeId, dto);
  }
}
```

## Environment Variables

```
DB_HOST              PostgreSQL host (default: localhost)
DB_PORT              PostgreSQL port (default: 5432)
DB_USERNAME          Database user (default: postgres)
DB_PASSWORD          Database password
DB_DATABASE          Database name (default: anaqat_iraq)
JWT_SECRET           Secret key for signing tokens
JWT_EXPIRATION       Token lifetime (default: 24h)
PORT                 API server port (default: 3000)
NODE_ENV             Environment (development/production)
CORS_ORIGIN          Allowed CORS origin (default: *)
UPLOAD_DIR           File upload directory (default: ./uploads)
```

## Database Relationships

```
Store (1) ──── (∞) User
          ──── (∞) ClothingItem
          ──── (∞) Sale
          ──── (∞) CustomerSession
          ──── (∞) AiProcessingJob
          ──── (∞) AuditLog

ClothingCategory (1) ──── (∞) ClothingItem
                     ──── (∞) ClothingCategory (parent)

ClothingItem (1) ──── (∞) SizeStock
                  ──── (∞) SaleLine
                  ──── (∞) OutfitRecommendationItem

Sale (1) ──── (∞) SaleLine

CustomerSession (1) ──── (∞) OutfitRecommendation

OutfitRecommendation (1) ──── (∞) OutfitRecommendationItem
```

## Next Steps

1. Start the server: `npm run start:dev`
2. Test API endpoints (see QUICK_START.md)
3. Build frontend integration
4. Set up monitoring and logging
5. Configure production database
6. Add API documentation (Swagger integration)
7. Implement AI features (image classification, recommendations)
8. Add email notifications
9. Set up backup strategy
10. Deploy to cloud platform

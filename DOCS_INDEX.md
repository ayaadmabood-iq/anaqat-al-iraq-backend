# Backend Documentation Index

Quick reference guide to all backend documentation and code structure.

## Start Here

**New to the project?** Start with this sequence:

1. **QUICK_START.md** (5 min read) - Get the backend running in 5 minutes
2. **README.md** (10 min read) - Full API reference and setup guide
3. **ARCHITECTURE.md** (15 min read) - Understanding the design and database
4. **FILE_STRUCTURE.md** (10 min read) - Navigate the codebase

## Documentation Files

| File | Purpose | Read Time |
|------|---------|-----------|
| **QUICK_START.md** | Setup in 5 minutes + test API | 5 min |
| **README.md** | Complete API documentation | 10 min |
| **ARCHITECTURE.md** | System design, database, flows | 15 min |
| **FILE_STRUCTURE.md** | Codebase navigation guide | 10 min |
| **DOCS_INDEX.md** | This file - documentation guide | 3 min |

## Code Structure

### Entry Points
- `src/main.ts` - Application bootstrap
- `src/app.module.ts` - Root module with all imports
- `package.json` - Dependencies and scripts

### Modules by Feature

**Authentication** (`src/modules/auth/`)
- Guards: JWT, Role-based access
- Login/Register endpoints
- Passport integration

**User Management** (`src/modules/users/`)
- Create/read/update/delete users
- Password management
- Store-scoped isolation

**Store Management** (`src/modules/store/`)
- Store CRUD operations
- Multi-tenant data isolation

**Inventory** (`src/modules/inventory/`)
- Item CRUD with colors/styles
- Size and stock management
- Search and filtering

**Sales** (`src/modules/sales/`)
- Sale transactions
- Stock reduction
- Revenue reporting

### Database (`src/database/`)

**14 Entities:**
- Store (root tenant entity)
- User (staff members)
- ClothingCategory (with hierarchy)
- ClothingItem (clothing products)
- SizeStock (inventory tracking)
- Sale (transactions)
- SaleLine (transaction items)
- CustomerSession (customer interactions)
- OutfitRecommendation (AI suggestions)
- OutfitRecommendationItem (outfit items)
- AiProcessingJob (background tasks)
- AuditLog (action tracking)

## Quick Links

### Setting Up
```bash
cd backend
npm install                    # Install dependencies
npm run seed                   # Load demo data
npm run start:dev             # Start development server
```

### Testing the API
- Login: `curl -X POST "http://localhost:3000/api/v1/auth/login?storeId=<id>" -H "Content-Type: application/json" -d '{"username":"owner","password":"demo123"}'`
- List items: `curl -X GET "http://localhost:3000/api/v1/inventory/items" -H "Authorization: Bearer <token>"`

### API Endpoints
See README.md for complete endpoint reference organized by:
- Authentication (login, register)
- Users (CRUD)
- Stores (CRUD)
- Inventory (items, sizes, stock)
- Sales (transactions, reports)

## Common Tasks

### Add New User
See: `src/modules/users/users.service.ts` - `createUser()` method

### Create Clothing Item
See: `src/modules/inventory/inventory.service.ts` - `createItem()` method

### Process a Sale
See: `src/modules/sales/sales.service.ts` - `createSale()` method with atomic stock reduction

### Add New Role
1. Update `UserRole` enum in `src/database/entities/user.entity.ts`
2. Use `@Roles()` decorator in controllers
3. RolesGuard automatically handles access control

### Query the Database
See: `src/database/entities/` - TypeORM Entity definitions with relationships

## Database Relationships

```
Store (1) ──────> (many) User
          ──────> (many) ClothingItem
          ──────> (many) Sale
          ──────> (many) CustomerSession
          ──────> (many) AiProcessingJob
          ──────> (many) AuditLog

ClothingCategory (1) ──> (many) ClothingItem
                     ──> (many) ClothingCategory (subcategories)

ClothingItem (1) ──> (many) SizeStock
                 ──> (many) SaleLine
                 ──> (many) OutfitRecommendationItem

Sale (1) ──> (many) SaleLine

CustomerSession (1) ──> (many) OutfitRecommendation

OutfitRecommendation (1) ──> (many) OutfitRecommendationItem
```

## User Roles & Permissions

| Role | Create Items | Create Users | Create Sales | View Reports |
|------|--------------|--------------|--------------|--------------|
| OWNER | ✓ | ✓ | ✓ | ✓ |
| MANAGER | ✓ | ✓ | ✓ | ✓ |
| SALES_STAFF | ✗ | ✗ | ✓ | ✗ |
| INVENTORY_STAFF | ✓ | ✗ | ✗ | ✗ |

See: `src/modules/auth/roles.guard.ts` for implementation

## Configuration

**Environment Variables** (`.env`):
```
DB_HOST=localhost              # Database host
DB_PORT=5432                   # Database port
DB_USERNAME=postgres           # Database user
DB_PASSWORD=postgres           # Database password
DB_DATABASE=anaqat_iraq        # Database name
JWT_SECRET=your-secret-key     # JWT signing secret
JWT_EXPIRATION=24h             # Token expiration
PORT=3000                      # API port
NODE_ENV=development           # Environment
```

See: `src/config/database.config.ts` for database configuration

## Performance & Optimization

**Indexes:**
- StoreID + status (inventory queries)
- StoreID + createdAt (sales queries)
- Clothing item + size (unique constraint)

**Eager Loading:**
- ClothingItem.sizes (loaded by default)
- Sale.lines (loaded by default)

See: ARCHITECTURE.md > Performance Considerations

## Testing

The codebase structure supports:
- Service unit tests (mock repositories)
- Controller integration tests (test fixtures)
- E2E tests (seeded database)

Example: Create test file `src/modules/inventory/inventory.service.spec.ts`

## Deployment

**Production Checklist:**
- Update JWT_SECRET
- Set NODE_ENV=production
- Configure DB credentials
- Set CORS_ORIGIN for frontend
- Disable database logging
- Enable SSL for database
- Set synchronize=false in TypeORM
- Configure backups

See: ARCHITECTURE.md > Deployment Checklist

## Troubleshooting

### Common Issues:
1. **Port 3000 in use** - Use `PORT=3001 npm run start:dev`
2. **Database connection error** - Check DB credentials in .env
3. **JWT expired** - Get new token via login endpoint
4. **401 Unauthorized** - Verify Authorization header format
5. **Role not allowed** - Check @Roles() decorator on endpoint

See: QUICK_START.md > Troubleshooting

## File Locations

```
backend/
├── README.md                    # API reference
├── QUICK_START.md              # 5-minute setup
├── ARCHITECTURE.md             # System design
├── FILE_STRUCTURE.md           # Code navigation
├── DOCS_INDEX.md               # This file
├── src/
│   ├── main.ts                 # App entry point
│   ├── app.module.ts           # Root module
│   ├── config/                 # Configuration
│   ├── database/               # Entities & seeding
│   └── modules/                # Feature modules
└── package.json                # Dependencies
```

## Key Features

- ✓ JWT Authentication with role-based access
- ✓ Multi-tenant architecture with store isolation
- ✓ Complete inventory management system
- ✓ Sales transaction processing with atomic operations
- ✓ Database seeding with demo data
- ✓ TypeORM with PostgreSQL
- ✓ Input validation via DTOs
- ✓ Comprehensive error handling
- ✓ CORS enabled
- ✓ Production-ready configuration

## Next Steps

1. **Get it running**: Follow QUICK_START.md
2. **Understand the design**: Read ARCHITECTURE.md
3. **Integrate with frontend**: Use endpoints from README.md
4. **Deploy**: Follow deployment checklist in ARCHITECTURE.md
5. **Extend features**: Add AI processing, email, etc.

## Support Resources

- **API Reference**: README.md
- **System Design**: ARCHITECTURE.md
- **Quick Reference**: QUICK_START.md
- **Code Navigation**: FILE_STRUCTURE.md
- **Source Code**: Comments and docstrings in implementation
- **NestJS Docs**: https://docs.nestjs.com
- **TypeORM Docs**: https://typeorm.io
- **Passport.js**: https://www.passportjs.org

## Summary

This backend provides a complete, production-ready API for the Anaqat Al-Iraq inventory and sales system. All code follows NestJS best practices with full TypeScript support, role-based access control, and comprehensive documentation.

**Ready to start?** → Open QUICK_START.md

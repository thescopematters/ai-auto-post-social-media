# ContentAI Pro REST API Documentation

## Base URL
```
http://localhost:3001/api/v1
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

### Authentication Endpoints

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "fullName": "John Doe"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "user"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  },
  "message": "Login successful"
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <access_token>
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>
```

## Workspace Endpoints

#### Get All Workspaces
```http
GET /workspaces
Authorization: Bearer <access_token>
```

#### Get Workspace by ID
```http
GET /workspaces/:workspaceId
Authorization: Bearer <access_token>
```

#### Create Workspace
```http
POST /workspaces
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "My Workspace",
  "brandColor": "#3B82F6",
  "logoUrl": "https://example.com/logo.png"
}
```

#### Update Workspace
```http
PUT /workspaces/:workspaceId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Updated Workspace Name",
  "brandColor": "#10B981"
}
```

#### Delete Workspace
```http
DELETE /workspaces/:workspaceId
Authorization: Bearer <access_token>
```

#### Get Workspace Members
```http
GET /workspaces/:workspaceId/members
Authorization: Bearer <access_token>
```

#### Add Workspace Member
```http
POST /workspaces/:workspaceId/members
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "userId": "user_uuid",
  "role": "editor"
}
```

## Document Endpoints

#### Get All Documents
```http
GET /workspaces/:workspaceId/documents?page=1&limit=20&search=keyword
Authorization: Bearer <access_token>
```

#### Get Document by ID
```http
GET /workspaces/:workspaceId/documents/:documentId
Authorization: Bearer <access_token>
```

#### Create Document
```http
POST /workspaces/:workspaceId/documents
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Document Title",
  "fileType": "manual",
  "contentText": "Document content here...",
  "metadata": {}
}
```

#### Update Document
```http
PUT /workspaces/:workspaceId/documents/:documentId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Updated Title",
  "contentText": "Updated content..."
}
```

#### Delete Document
```http
DELETE /workspaces/:workspaceId/documents/:documentId
Authorization: Bearer <access_token>
```

#### Get Document Stats
```http
GET /workspaces/:workspaceId/documents/stats
Authorization: Bearer <access_token>
```

## Content Generation Endpoints

#### Generate Content
```http
POST /workspaces/:workspaceId/generate
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "documentId": "document_uuid",
  "platform": "linkedin",
  "tone": "professional",
  "variantCount": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "post_uuid",
      "content": "Generated post content...",
      "platform": "linkedin",
      "variant_number": 1,
      "moderation_status": "pending",
      "predicted_score": 8.5
    }
  ],
  "message": "Content generated successfully"
}
```

#### Get All Posts
```http
GET /workspaces/:workspaceId/posts?page=1&limit=20&status=pending&platform=linkedin
Authorization: Bearer <access_token>
```

#### Get Post by ID
```http
GET /workspaces/:workspaceId/posts/:postId
Authorization: Bearer <access_token>
```

#### Update Post
```http
PUT /workspaces/:workspaceId/posts/:postId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "content": "Updated post content",
  "hashtags": ["AI", "Marketing", "Innovation"],
  "mediaUrls": ["https://example.com/image.jpg"]
}
```

#### Delete Post
```http
DELETE /workspaces/:workspaceId/posts/:postId
Authorization: Bearer <access_token>
```

#### Moderate Post
```http
POST /workspaces/:workspaceId/posts/:postId/moderate
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "action": "approve",
  "reason": "Content looks great"
}
```

**Actions:** `approve`, `reject`, `flag`

## Dashboard & Analytics Endpoints

#### Get Dashboard Stats
```http
GET /workspaces/:workspaceId/stats
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDocuments": 10,
    "totalPosts": 50,
    "scheduledPosts": 5,
    "pendingModeration": 3,
    "publishedThisMonth": 20,
    "avgEngagementRate": 4.5
  }
}
```

#### Get Recent Activity
```http
GET /workspaces/:workspaceId/activity?limit=10
Authorization: Bearer <access_token>
```

#### Get Analytics
```http
GET /workspaces/:workspaceId/analytics
Authorization: Bearer <access_token>
```

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Rate Limiting

- **General API:** 100 requests per 15 minutes
- **Authentication:** 5 requests per 15 minutes
- **File Uploads:** 20 requests per hour

## Pagination

Paginated endpoints support these query parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

Response includes metadata:
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Workspace Roles

- **admin** - Full access to workspace settings and members
- **editor** - Can create, edit, and delete content
- **viewer** - Read-only access

## Development

### Running the API Server

```bash
# Development mode
npm run dev:server

# Production mode
npm run build
npm run server
```

### Seeding the Database

```bash
npm run seed
```

This creates a demo user:
- Email: `demo@contentai.com`
- Password: `Demo123456!`

### Environment Variables

Create a `.env` file with:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

PORT=3001
NODE_ENV=development
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:5173

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Testing with cURL

### Register a new user
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456!","fullName":"Test User"}'
```

### Login
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456!"}'
```

### Get workspaces (with token)
```bash
curl -X GET http://localhost:3001/api/v1/workspaces \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourorg/contentai-pro
- Email: support@contentaipro.com

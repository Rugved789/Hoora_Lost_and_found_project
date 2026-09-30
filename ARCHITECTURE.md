# BackToYou - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Feed   │  │   Post   │  │  Claim   │  │ Profile  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│         │              │              │              │      │
│         └──────────────┴──────────────┴──────────────┘      │
│                          │                                  │
│                    Clerk Auth                               │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTPS/JSON
┌──────────────────────────┼──────────────────────────────────┐
│                    Express Server                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware: Clerk, Helmet, CORS, Rate Limit, Logger│   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Items   │  │  Claims  │  │  Stats   │  │   User   │   │
│  │  Routes  │  │  Routes  │  │  Routes  │  │  Routes  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │              │         │
│  ┌────┴─────────────┴──────────────┴──────────────┴─────┐   │
│  │              Service Layer                            │   │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────────┐        │   │
│  │  │   AI    │  │ Matching │  │  Cloudinary  │        │   │
│  │  │ (Claude)│  │  Engine  │  │   Upload     │        │   │
│  │  └─────────┘  └──────────┘  └──────────────┘        │   │
│  └────────────────────┬──────────────────────────────────┘   │
│                       │                                      │
│  ┌────────────────────┴──────────────────────────────────┐   │
│  │          PostgreSQL Connection Pool                   │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                   External Services                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │    Neon    │  │  Anthropic │  │ Cloudinary │            │
│  │ PostgreSQL │  │   Claude   │  │   Images   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Users
- Stores user profiles from Clerk
- Tracks karma points
- Auto-created on first login
- Domain restriction support

### Items
- Lost or found items
- AI-generated tags and metadata
- Hidden details for verification (JSONB)
- Status workflow: open → at_desk → claimed → returned

### Claims
- Verification attempts
- Stores questions and answers
- Tracks score and pass/fail
- Max 3 attempts per user per item

### Matches
- Precomputed item matches
- Score and reason from AI
- Bidirectional: lost ↔ found

## Authentication Flow

### Clerk Mode (Production)
```
User Login → Clerk → JWT Token → Express clerkMiddleware
    ↓
requireUser middleware checks token
    ↓
Lookup user by clerk_id
    ↓
If not found: fetch from Clerk API, check domain, upsert
    ↓
Attach req.user to request
```

### Mock Mode (Testing)
```
Request with x-user-id header
    ↓
requireUser reads header
    ↓
Lookup user by ID directly
    ↓
Attach req.user to request
```

## AI Service Layer

All AI functions have automatic fallbacks:

### 1. Image Tagging (`tagImage`)
- **Input**: Image buffer + mime type
- **AI**: Claude analyzes image, extracts title, category, color, brand, tags, description, hidden_details
- **Fallback**: Use user description, category='other', empty tags
- **Timeout**: 10s

### 2. Match Reranking (`rerankMatches`)
- **Input**: Lost item + up to 5 candidate found items
- **AI**: Claude scores each match 0-100 with reasoning
- **Fallback**: Tag overlap scoring (overlap * 20)
- **Timeout**: 10s

### 3. Question Generation (`generateQuestions`)
- **Input**: Hidden details JSONB
- **AI**: Claude generates 3 verification questions
- **Fallback**: Generic questions about features, condition, contents
- **Timeout**: 10s

### 4. Answer Scoring (`scoreAnswers`)
- **Input**: Questions, user answers, hidden details
- **AI**: Claude scores each answer, lenient on wording, strict on facts
- **Fallback**: Keyword matching against hidden_details
- **Timeout**: 10s

## Matching Pipeline

### For Lost Items
```
1. SQL Shortlist
   - Same category OR color OR tag overlap
   - Type = 'found', status = 'open'
   - Order by relevance (category=3pts, color=2pts, tag overlap)
   - LIMIT 5

2. AI Reranking
   - Send lost item + candidates to Claude
   - Get scores 0-100 with reasons
   - Store in matches table

3. Return Results
   - Sorted by score DESC
```

### For Found Items
```
1. SQL Shortlist (same as above, but type='lost')

2. Simple Scoring
   - Tag overlap * 20 + category match * 20
   - No AI reranking (reverse matching less accurate)

3. Store and Return
```

## Security Measures

### Input Validation
- Zod schemas for all requests
- File type checking (images only)
- File size limit (5MB)

### Rate Limiting
- Global: 100 requests/minute
- AI endpoints: 10 requests/minute per user
- Key: user ID when authenticated, IP otherwise

### Data Protection
- Parameterized queries (SQL injection prevention)
- Helmet security headers
- CORS restricted to client origin
- Never log tokens or secrets

### Privacy
- Public endpoints NEVER return:
  - `hidden_details`
  - Found item `image_url` (only `has_image: true`)
  - Email addresses (except in /me)
- Leak test enforces this

### Authorization
- Items: Owner can view matches
- Claims: Claimant can answer questions
- Status updates: Only poster can change status
- Can't claim own items

## Status Workflow

```
Item Posted (status: 'open')
        ↓
   [At Lost & Found Desk]
        ↓
   status: 'at_desk'  ← Finder updates
        ↓
   [User Claims Successfully]
        ↓
   status: 'claimed'  ← Auto-updated
        ↓
   [Item Returned to Owner]
        ↓
   status: 'returned' ← Finder updates
        ↓
   [Finder gets +10 karma]
```

Allowed transitions:
- open → at_desk
- at_desk → claimed
- claimed → returned

## Error Handling

### Operational Errors
- Custom `AppError` class with status code and error code
- Consistent JSON format: `{error: "message", code: "CODE"}`
- Codes: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, etc.

### AI Failures
- Never crash the request
- Always fall back to non-AI methods
- Log errors for monitoring

### Database Errors
- Connection pool with retry logic
- Graceful shutdown on SIGTERM/SIGINT
- Transaction support where needed

## Performance Optimizations

### Database
- Indexes on type, status, category
- GIN index on tags array
- Connection pooling (max 20)
- LIMIT queries to prevent large scans

### API
- Pagination (LIMIT 100 items in feed)
- Efficient SQL with explicit column selection
- Avoid N+1 queries

### AI
- Cache results (tags, hidden_details stored permanently)
- Questions cached per claim
- 10s timeout prevents hanging
- Fallbacks prevent degraded experience

## Frontend Architecture

### Pages
- **Feed**: Public item browsing with filters
- **PostItem**: Create lost/found items with image upload
- **ItemDetail**: View single item
- **Matches**: View AI-ranked matches (auth required)
- **Claim**: Verification question flow (auth required)
- **Profile**: User stats, posts, claims (auth required)
- **Hotspots**: Map visualization of lost items
- **Leaderboard**: Top users by karma

### State Management
- Component-level state (useState)
- No global state library (simple app)
- API calls via utility wrapper

### Authentication
- Clerk SDK for React
- SignedIn/SignedOut components
- useAuth hook for tokens
- Token passed in Authorization header

### Styling
- Tailwind CSS utility classes
- No custom CSS needed
- Responsive design (mobile-first)

## Deployment Considerations

### Environment Variables
- Different keys for dev/staging/prod
- Never commit .env files
- Use platform-specific secrets management

### Database
- Neon auto-scales
- No manual connection pooling config needed
- Migrations can be scripted via schema.sql

### API Server
- Can run on any Node.js host (Vercel, Railway, Render, etc.)
- Set NODE_ENV=production
- Enable HTTPS in production

### Frontend
- Static build via Vite
- Can deploy to Vercel, Netlify, Cloudflare Pages
- Set VITE_API_URL to production backend

## Testing Strategy

### Manual Testing
- curl commands for each endpoint
- Test both authenticated and public access
- Verify error cases

### Automated Testing
- Leak test script checks security
- Can be run in CI/CD pipeline

### User Acceptance Testing
- Complete demo flow from README
- Test on mobile devices
- Verify Clerk auth flow

## Scalability

### Current Capacity
- Single server can handle 1000s of users
- PostgreSQL connection pooling
- AI rate limiting prevents abuse

### Future Improvements
- Redis caching for hot items
- CDN for images (Cloudinary provides this)
- Database read replicas
- Horizontal scaling with load balancer
- Background job queue for AI processing

## Monitoring

### Logs
- Request logs (method, path, status, duration)
- Error logs (server errors only)
- No PII in logs

### Metrics to Track
- API response times
- AI success/fallback rate
- Claim pass rate
- Item match quality (user feedback)

### Alerts
- High error rate
- AI API failures
- Database connection issues
- Rate limit violations

## Security Checklist

- ✅ Parameterized SQL queries
- ✅ Input validation (Zod)
- ✅ Rate limiting
- ✅ CORS restrictions
- ✅ Helmet security headers
- ✅ File upload restrictions
- ✅ No PII leaks (leak test)
- ✅ Authentication required for sensitive operations
- ✅ Authorization checks (ownership)
- ✅ No tokens/secrets in logs
- ✅ HTTPS in production (via hosting platform)
- ✅ Domain restrictions (optional)

## Known Limitations

1. **Image-only AI tagging**: Lost items without images get minimal tagging
2. **Match quality**: Depends on AI availability and quality of descriptions
3. **No real-time updates**: Client must refresh to see new items
4. **Single claim at a time**: Users can't claim multiple items simultaneously
5. **No item editing**: Once posted, items can't be edited (would invalidate matches)
6. **No admin dashboard**: Admin features are minimal

## Future Enhancements

- Real-time notifications (WebSocket or SSE)
- Image comparison in matching
- Multi-language support
- Mobile app (React Native)
- Analytics dashboard
- User reputation system beyond karma
- Item categories with custom fields
- Bulk upload for lost & found offices
- Integration with campus security systems

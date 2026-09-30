# BackToYou 🎯

**AI-Powered Campus Lost & Found Application**

An intelligent lost and found system for campus communities with AI-powered image analysis, smart matching, and owner verification.

## ✨ Features

- **AI Image Analysis**: Automatic tagging of items with Claude AI
- **Smart Matching**: AI ranks potential matches with reasoning
- **Owner Verification**: AI-generated questions prove ownership
- **Karma System**: Reward users for returning items
- **Hotspot Mapping**: Visualize where items are lost most
- **Secure**: Domain restrictions, rate limiting, data leak protection
- **Fallback Design**: Works even if AI services fail

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get running in 5 minutes
- **[SETUP.md](SETUP.md)** - Detailed setup instructions
- **[TEST_COMMANDS.md](TEST_COMMANDS.md)** - Complete curl test examples
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical architecture deep-dive
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - What was built and why

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (Neon recommended)
- Cloudinary account
- Anthropic API key
- Clerk account

### Installation

```bash
npm run install:all
```

### Environment Setup

1. Copy `.env.example` files:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

2. Fill in your credentials in both `.env` files

3. Initialize the database:
```bash
cd server
npm run db:reset
```

### Development

```bash
# Run both server and client (from root)
npm run dev

# Or run separately:
npm run dev:server
npm run dev:client
```

Server runs on http://localhost:4000  
Client runs on http://localhost:5173

## Testing

### Mock Auth Mode (for curl testing)

Set `AUTH_MODE=mock` in `server/.env` to bypass Clerk and use `x-user-id` header.

### Leak Test

```bash
cd server
npm run test:leak
```

Ensures no sensitive data leaks in public endpoints.

## API Examples

All examples use mock auth mode. Set `AUTH_MODE=mock` in `server/.env` and use `x-user-id` header.

### Health Check
```bash
curl http://localhost:4000/api/health
```

### Get Items Feed
```bash
# All items
curl http://localhost:4000/api/items

# Filter by type
curl http://localhost:4000/api/items?type=lost

# Filter by category
curl http://localhost:4000/api/items?category=electronics

# Search
curl "http://localhost:4000/api/items?q=earbuds"
```

### Get Single Item
```bash
curl http://localhost:4000/api/items/1
```

### Post Lost Item (without image)
```bash
curl -X POST http://localhost:4000/api/items \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "lost",
    "description": "Black wireless earbuds case",
    "location_name": "Library",
    "lat": 21.1458,
    "lng": 79.0882,
    "happened_at": "2024-01-15T10:30:00Z"
  }'
```

### Post Found Item (with image)
```bash
curl -X POST http://localhost:4000/api/items \
  -H "x-user-id: 2" \
  -F "image=@/path/to/image.jpg" \
  -F "type=found" \
  -F "description=Found black earbuds case" \
  -F "location_name=Library" \
  -F "lat=21.1458" \
  -F "lng=79.0883" \
  -F "happened_at=2024-01-15T11:00:00Z"
```

### Get Matches for Lost Item
```bash
curl http://localhost:4000/api/items/1/matches \
  -H "x-user-id: 1"
```

### Start Claim
```bash
curl -X POST http://localhost:4000/api/items/6/claim/start \
  -H "x-user-id: 2" \
  -H "Content-Type: application/json"
```

### Submit Claim Answers
```bash
curl -X POST http://localhost:4000/api/claims/1/answer \
  -H "x-user-id: 2" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      "It has scratches on the back",
      "Both earbuds were inside",
      "Used condition with minor wear"
    ]
  }'
```

### Update Item Status
```bash
curl -X PATCH http://localhost:4000/api/items/6/status \
  -H "x-user-id: 3" \
  -H "Content-Type: application/json" \
  -d '{"status": "at_desk"}'
```

### Get Current User Profile
```bash
curl http://localhost:4000/api/me \
  -H "x-user-id: 1"
```

### Get Hotspots
```bash
curl http://localhost:4000/api/stats/hotspots
```

### Get Leaderboard
```bash
curl http://localhost:4000/api/leaderboard
# or
curl http://localhost:4000/api/stats/leaderboard
```

## Tech Stack

**Backend:** Node.js (ES modules), Express, PostgreSQL (Neon / raw SQL), Cloudinary, Anthropic SDK  
**Frontend:** React, Vite, Tailwind CSS, React Router, Clerk  
**Auth:** Clerk (@clerk/express, @clerk/clerk-react)  
**AI:** Anthropic SDK (`claude-sonnet-5-5`)

---

## 🎯 Demo Flow

The perfect flow to demonstrate all features:

1. **Sign in** with Clerk
2. **Post a found item** (e.g., "black earbuds case") with an image
3. **View AI-generated tags** - category, color, brand, hidden details
4. **Switch accounts** - Sign in as different user
5. **Post a lost item** (e.g., "lost my earbuds") with vague description
6. **View Matches** - See the found item ranked by AI with reasoning
7. **Start Claim** - AI generates 3 verification questions from image
8. **Try wrong answers** - Fail the verification (attempts left: 2)
9. **Try correct answers** - Pass and get finder's contact info
10. **Update status** - Finder marks: open → at_desk → claimed → returned
11. **Check karma** - Finder gets +10 karma points
12. **View Hotspots** - Interactive map showing lost item locations
13. **View Leaderboard** - Top users ranked by karma

## 🧪 Testing

### Run Leak Test
```bash
cd server
AUTH_MODE=mock npm run test:leak
```

This verifies no sensitive data leaks in public endpoints.

### Manual Testing
See [TEST_COMMANDS.md](TEST_COMMANDS.md) for comprehensive curl examples.

---

## 📦 Project Structure

```
campus_lost_found/
├── server/              # Backend API
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   ├── services/   # AI, matching, uploads
│   │   ├── middleware/ # Auth, validation
│   │   └── utils/      # DB, errors, logging
│   ├── db/             # Schema and seeds
│   └── scripts/        # DB reset, leak test
├── client/             # Frontend React app
│   └── src/
│       ├── pages/      # 8 page components
│       └── utils/      # API wrapper
└── docs/               # Documentation files
```

---

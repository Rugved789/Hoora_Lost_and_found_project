# BackToYou Setup Guide

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Neon PostgreSQL** - [Sign up](https://neon.tech/)
3. **Cloudinary** - [Sign up](https://cloudinary.com/)
4. **Anthropic API** - [Get key](https://console.anthropic.com/)
5. **Clerk** - [Sign up](https://clerk.com/)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
cd ..
```

### 2. Setup Neon PostgreSQL

1. Create a new project at [neon.tech](https://neon.tech/)
2. Copy the connection string (looks like: `postgresql://user:pass@host.neon.tech/database`)
3. Save it for the next step

### 3. Setup Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com/)
2. Go to Dashboard
3. Copy the "API Environment variable" (format: `cloudinary://api_key:api_secret@cloud_name`)
4. Save it for the next step

### 4. Setup Anthropic

1. Sign up at [console.anthropic.com](https://console.anthropic.com/)
2. Go to API Keys
3. Create a new key
4. Save it for the next step

### 5. Setup Clerk

1. Sign up at [clerk.com](https://clerk.com/)
2. Create a new application
3. Copy the Publishable Key (starts with `pk_test_` or `pk_live_`)
4. Copy the Secret Key (starts with `sk_test_` or `sk_live_`)
5. Optionally, configure email domain restrictions in Clerk dashboard
6. Save them for the next step

### 6. Configure Environment Variables

#### Server (.env)

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
DATABASE_URL=postgresql://your-neon-connection-string
ANTHROPIC_API_KEY=sk-ant-your-api-key
CLAUDE_MODEL=claude-sonnet-4-20250514
CLOUDINARY_URL=cloudinary://your-cloudinary-url
CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-key
CLERK_SECRET_KEY=sk_test_your-clerk-secret
PORT=4000
AI_ENABLED=true
AUTH_MODE=clerk
ALLOWED_EMAIL_DOMAIN=
```

Optional: Set `ALLOWED_EMAIL_DOMAIN=sitnagpur.siu.edu.in` to restrict to specific domain.

#### Client (.env)

```bash
cd ../client
cp .env.example .env
```

Edit `client/.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-key
VITE_API_URL=http://localhost:4000
```

### 7. Initialize Database

```bash
cd server
npm run db:reset
```

This will:
- Drop existing tables (if any)
- Create all tables with proper schemas
- Seed 14 realistic campus items for testing

### 8. Start Development Servers

#### Option 1: Run both together (from root)

```bash
npm run dev
```

#### Option 2: Run separately

Terminal 1 (Server):
```bash
cd server
npm run dev
```

Terminal 2 (Client):
```bash
cd client
npm run dev
```

### 9. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4000

## Testing with Mock Auth (for curl/Postman)

For testing without Clerk authentication:

1. Edit `server/.env`:
```env
AUTH_MODE=mock
```

2. Restart the server

3. Use `x-user-id` header in requests:
```bash
curl http://localhost:4000/api/me -H "x-user-id: 1"
```

User IDs from seed data: 1, 2, 3

## Running Tests

### Leak Test

Ensures no sensitive data leaks in public endpoints:

```bash
cd server
AUTH_MODE=mock npm run test:leak
```

## Demo Flow

1. **Sign in** with Clerk (or use mock auth for testing)
2. **User 1**: Post a found item (black earbuds case) with an image
3. **User 2**: Post a lost item (earbuds case) with vague description
4. **User 2**: View matches → see the found item ranked by AI
5. **User 2**: Claim the found item → answer verification questions
6. **User 2**: Try wrong answers first (fail)
7. **User 2**: Try correct answers (pass) → get finder's contact info
8. **User 1**: Update item status from open → at_desk → claimed → returned
9. **User 1**: Check profile → see karma increased by 10

## Troubleshooting

### Database Connection Issues

- Verify your Neon connection string is correct
- Check if your IP is allowed in Neon dashboard
- Ensure the database exists

### Cloudinary Upload Fails

- Verify your CLOUDINARY_URL format
- Check your Cloudinary quota/limits
- Ensure the cloud name is correct

### AI Features Not Working

- Verify ANTHROPIC_API_KEY is correct
- Check API quota/credits
- Set `AI_ENABLED=false` to disable AI and use fallbacks

### Clerk Auth Issues

- Verify both publishable and secret keys
- Check if keys match (test/production)
- Ensure CORS is configured correctly

### Port Already in Use

Change ports in:
- `server/.env`: `PORT=4001`
- `client/.env`: `VITE_API_URL=http://localhost:4001`
- `client/vite.config.js`: `server: { port: 5174 }`

## Production Deployment

### Backend (Node.js)

1. Set environment variables on your hosting platform
2. Set `AUTH_MODE=clerk` (not mock!)
3. Set `CLIENT_URL` to your frontend domain for CORS
4. Run: `npm start`

### Frontend (Vite)

1. Build: `npm run build`
2. Deploy the `dist` folder to any static hosting
3. Set environment variables before build:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_API_URL`

### Database

Neon handles production automatically. No additional setup needed.

## Support

For issues or questions:
- Check the README.md for API examples
- Review the code comments
- Ensure all environment variables are set correctly

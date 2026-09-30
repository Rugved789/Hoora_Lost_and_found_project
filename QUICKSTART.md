# BackToYou - Quick Start (5 Minutes)

Get the app running in 5 minutes for demo/testing purposes.

## Prerequisites Check

```bash
node --version  # Should be 18+
npm --version   # Should be 9+
```

## 1. Install Everything

```bash
# From project root
cd server && npm install && cd ../client && npm install && cd ..
```

## 2. Get Your Credentials

You need 4 services (all have free tiers):

1. **Neon PostgreSQL** - https://neon.tech/
   - Sign up → Create project → Copy connection string
   
2. **Cloudinary** - https://cloudinary.com/
   - Sign up → Dashboard → Copy "API Environment variable"
   
3. **Anthropic** - https://console.anthropic.com/
   - Sign up → API Keys → Create key
   
4. **Clerk** - https://clerk.com/
   - Sign up → Create application → Copy publishable and secret keys

## 3. Configure Server

Edit `server/.env`:

```env
DATABASE_URL=postgresql://your-connection-string-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
CLAUDE_MODEL=claude-sonnet-4-20250514
CLOUDINARY_URL=cloudinary://your-url-here
CLERK_PUBLISHABLE_KEY=pk_test_your-key-here
CLERK_SECRET_KEY=sk_test_your-key-here
PORT=4000
AI_ENABLED=true
AUTH_MODE=clerk
ALLOWED_EMAIL_DOMAIN=
```

## 4. Configure Client

Edit `client/.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-key-here
VITE_API_URL=http://localhost:4000
```

## 5. Setup Database

```bash
cd server
npm run db:reset
```

This creates tables and seeds 14 items.

## 6. Start Both Servers

**Terminal 1** (Server):
```bash
cd server
npm run dev
```

Wait for: `🚀 Server running on port 4000`

**Terminal 2** (Client):
```bash
cd client
npm run dev
```

Wait for: `Local: http://localhost:5173/`

## 7. Open Browser

Go to: **http://localhost:5173**

## 8. Test It

1. Click "Sign In" (Clerk will prompt you to create account)
2. Click "Post Item"
3. Upload an image
4. Submit and see AI-generated tags
5. Browse the feed
6. Check out Hotspots and Leaderboard

## Quick Test with Mock Auth

If you want to test API directly without setting up Clerk:

1. Edit `server/.env`: `AUTH_MODE=mock`
2. Restart server
3. Use curl commands from `TEST_COMMANDS.md`

Example:
```bash
curl http://localhost:4000/api/items
```

## Troubleshooting

### "Cannot connect to database"
- Check DATABASE_URL is correct
- Verify your IP is allowed in Neon dashboard

### "Cloudinary upload failed"
- Verify CLOUDINARY_URL format
- Check your Cloudinary account is active

### "AI tagging failed"
- Check ANTHROPIC_API_KEY is correct
- Verify you have API credits
- App will work anyway (uses fallbacks)

### "Port already in use"
- Change PORT in `server/.env`
- Change port in `client/.env` VITE_API_URL
- Update `client/vite.config.js` server port

### "Clerk authentication not working"
- Verify both keys are from the same Clerk application
- Check keys are not expired
- Ensure you're using the correct environment (test/production)

## Next Steps

- Read `README.md` for full documentation
- Check `TEST_COMMANDS.md` for API testing
- Review `ARCHITECTURE.md` for technical details
- See `SETUP.md` for production deployment

## Demo Flow for Presentation

1. Show the feed (seeded items already there)
2. Sign in with Clerk
3. Post a found item with image → AI generates tags
4. Post a lost item → See AI matches
5. Go to Matches → Show scoring and reasoning
6. Start a claim → Show verification questions
7. Answer questions → Show pass/fail
8. Show Hotspots map
9. Show Leaderboard with karma
10. Show profile with your posts and claims

## Need Help?

Check the documentation files:
- README.md - Main docs + API examples
- SETUP.md - Detailed setup
- TEST_COMMANDS.md - Curl examples
- ARCHITECTURE.md - How it works
- PROJECT_SUMMARY.md - What was built

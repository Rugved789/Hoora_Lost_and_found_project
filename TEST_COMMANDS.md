# BackToYou - Test Commands

All commands assume server is running on `localhost:4000` with `AUTH_MODE=mock`.

## 1. Health Check

```bash
curl http://localhost:4000/api/health
```

Expected: `{"status":"ok","timestamp":"..."}`

---

## 2. Get All Items (Public)

```bash
curl http://localhost:4000/api/items
```

Should return seeded items. Note: Found items should have `has_image` instead of `image_url`, and no `hidden_details`.

---

## 3. Filter Items

### Lost items only
```bash
curl "http://localhost:4000/api/items?type=lost"
```

### Electronics category
```bash
curl "http://localhost:4000/api/items?category=electronics"
```

### Search for earbuds
```bash
curl "http://localhost:4000/api/items?q=earbuds"
```

---

## 4. Get Single Item

```bash
curl http://localhost:4000/api/items/1
```

Should NOT return `hidden_details` or `image_url` for found items.

---

## 5. Post Lost Item (No Image)

```bash
curl -X POST http://localhost:4000/api/items \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"lost\",\"description\":\"Black wireless earbuds\",\"location_name\":\"Library\",\"lat\":21.1458,\"lng\":79.0882,\"happened_at\":\"2024-01-15T10:00:00Z\"}"
```

Should return:
- Created item with AI-generated tags (or fallback tags)
- Potential matches array

---

## 6. Get Matches for Lost Item (Owner Only)

Replace `{item_id}` with the ID from step 5:

```bash
curl http://localhost:4000/api/items/1/matches \
  -H "x-user-id: 1"
```

Should return ranked matches with scores and reasons.

---

## 7. Start Claim Process

Try to claim item #6 (a found item from seed data):

```bash
curl -X POST http://localhost:4000/api/items/6/claim/start \
  -H "x-user-id: 2" \
  -H "Content-Type: application/json"
```

Should return:
- `claim_id`
- 3 verification questions
- `attempts_left: 3`

---

## 8. Submit Wrong Answers (First Attempt)

Replace `{claim_id}` with ID from step 7:

```bash
curl -X POST http://localhost:4000/api/claims/1/answer \
  -H "x-user-id: 2" \
  -H "Content-Type: application/json" \
  -d "{\"answers\":[\"I don't know\",\"Maybe black\",\"Good condition\"]}"
```

Should return:
- `passed: false`
- Low score
- `attempts_left: 2`

---

## 9. Submit Correct Answers (Based on Seed Data)

Item #6 hidden details from seed:
- Scratched back panel, small dent on right corner
- Both earbuds present, charging cable
- Faded sticker mark on top

```bash
curl -X POST http://localhost:4000/api/claims/1/answer \
  -H "x-user-id: 2" \
  -H "Content-Type: application/json" \
  -d "{\"answers\":[\"Scratched back with a small dent on the corner\",\"Both earbuds and charging cable inside\",\"Used condition with minor scratches\"]}"
```

Should return:
- `passed: true`
- High score (>=70)
- `finder` object with contact info
- `attempts_left: 2` or less

---

## 10. Update Item Status (Finder Only)

```bash
# Move to desk
curl -X PATCH http://localhost:4000/api/items/6/status \
  -H "x-user-id: 3" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"at_desk\"}"

# Mark as claimed
curl -X PATCH http://localhost:4000/api/items/6/status \
  -H "x-user-id: 3" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"claimed\"}"

# Mark as returned (gives karma)
curl -X PATCH http://localhost:4000/api/items/6/status \
  -H "x-user-id: 3" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"returned\"}"
```

The last command should give +10 karma to user #3.

---

## 11. Get User Profile

```bash
curl http://localhost:4000/api/me \
  -H "x-user-id: 3"
```

Should show:
- User info with karma (should be 10+ after step 10)
- User's posts
- User's claims

---

## 12. Get Hotspots

```bash
curl http://localhost:4000/api/stats/hotspots
```

Returns locations grouped by lost item count.

---

## 13. Get Leaderboard

```bash
curl http://localhost:4000/api/stats/leaderboard
```

Returns top 10 users by karma (should show user #3 with 10+ karma).

---

## 14. Run Leak Test

```bash
cd server
npm run test:leak
```

This automatically tests all public endpoints to ensure:
- No `hidden_details` leak
- No email addresses in public responses
- Found items return `has_image` instead of `image_url`

---

## Complete Demo Flow

```bash
# 1. Health check
curl http://localhost:4000/api/health

# 2. View existing items
curl http://localhost:4000/api/items

# 3. User 2 posts a lost item
curl -X POST http://localhost:4000/api/items \
  -H "x-user-id: 2" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"lost\",\"description\":\"Black earbuds case\",\"location_name\":\"Library\",\"lat\":21.1458,\"lng\":79.0882,\"happened_at\":\"2024-01-15T10:00:00Z\"}"

# 4. View matches (use item ID from response)
curl http://localhost:4000/api/items/15/matches \
  -H "x-user-id: 2"

# 5. Claim item #6
curl -X POST http://localhost:4000/api/items/6/claim/start \
  -H "x-user-id: 2" \
  -H "Content-Type: application/json"

# 6. Submit answers (use claim ID from response)
curl -X POST http://localhost:4000/api/claims/2/answer \
  -H "x-user-id: 2" \
  -H "Content-Type: application/json" \
  -d "{\"answers\":[\"Scratched back with dent\",\"Both earbuds inside\",\"Used condition\"]}"

# 7. Update status to returned
curl -X PATCH http://localhost:4000/api/items/6/status \
  -H "x-user-id: 3" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"at_desk\"}"

curl -X PATCH http://localhost:4000/api/items/6/status \
  -H "x-user-id: 3" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"claimed\"}"

curl -X PATCH http://localhost:4000/api/items/6/status \
  -H "x-user-id: 3" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"returned\"}"

# 8. Check leaderboard
curl http://localhost:4000/api/stats/leaderboard

# 9. Run leak test
cd server && npm run test:leak
```

---

## Notes

- Replace `{item_id}` and `{claim_id}` with actual IDs from responses
- User IDs 1, 2, 3 exist in seed data
- Item IDs 1-14 exist in seed data
- Item #6 is a found "Black Wireless Earbuds Case"
- All timestamps should be in ISO 8601 format
- Set `AUTH_MODE=mock` in server/.env for these tests

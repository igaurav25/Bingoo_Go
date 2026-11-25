# BINGO CHAMPIONSHIP — RESTFUL API REFERENCE

Base URL: `http://localhost:3000/api` (or `http://<LAN_IP>:3000/api`)

---

## 1. Authentication Endpoints

### `POST /api/auth/register`
Registers a new player account with bcrypt password hashing and 500 initial welcome coins.
- **Request Body**:
  ```json
  {
    "username": "Rohit_23",
    "password": "SecretPassword123",
    "email": "rohit@example.com",
    "avatar": "🦊"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "user": {
      "id": "cuid...",
      "username": "Rohit_23",
      "avatar": "🦊",
      "wallet": { "balance": 500 }
    },
    "token": "sess_..."
  }
  ```

### `POST /api/auth/login`
Authenticates player credentials and issues a session bearer token.
- **Request Body**:
  ```json
  {
    "username": "Rohit_23",
    "password": "SecretPassword123"
  }
  ```

---

## 2. Tournament Endpoints

### `GET /api/tournaments`
Returns all active and upcoming tournaments.
- **Query Parameters**: `?format=KNOCKOUT|LEAGUE|HYBRID`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "tournaments": [
      {
        "id": "tourn-ipl-season-1",
        "name": "BINGO Championship League",
        "format": "HYBRID",
        "status": "IN_PROGRESS",
        "participantsCount": 8,
        "maxParticipants": 8,
        "prizePool": 10000
      }
    ]
  }
  ```

### `POST /api/tournaments`
Creates a new custom tournament (Knockout, League, or Hybrid).
- **Request Body**:
  ```json
  {
    "name": "Weekend Knockout Cup",
    "format": "KNOCKOUT",
    "maxParticipants": 8,
    "prizePool": 5000,
    "creatorId": "user-123"
  }
  ```

### `POST /api/tournaments/join`
Registers a participant into a tournament roster by ID or 5-character invitation code.

### `POST /api/tournaments/:id/start`
Starts tournament matches, generates fixtures, and advances rounds.

---

## 3. Wallet & Economy Endpoints

### `GET /api/wallet/transactions`
Retrieves the atomic audit ledger of coin rewards, tournament entry fees, and win bonuses.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "balance": 12450,
    "transactions": [
      { "id": "tx-1", "type": "MATCH_WIN", "amount": 150, "description": "1v1 Match Victory", "date": "Just now" },
      { "id": "tx-2", "type": "TOURNAMENT_PRIZE", "amount": 750, "description": "Quarter-Final Victory", "date": "Today" }
    ]
  }
  ```

---

## 4. Friends Endpoints

### `GET /api/friends`
Returns player friends list with presence status (`ONLINE`, `IN_GAME`, `OFFLINE`).

### `POST /api/friends/request`
Sends a mutual friend request.

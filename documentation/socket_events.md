# BINGO CHAMPIONSHIP — REAL-TIME WEBSOCKET PROTOCOL

WebSocket URL: `ws://localhost:3000` (or `ws://<LAN_IP>:3000`)

---

## 1. Connection & Session Ownership

Upon opening a WebSocket connection, the client sends an initial handshake or joins a room:
```json
{
  "type": "join_room",
  "roomCode": "B4K8M",
  "playerId": "p_rohit23",
  "playerName": "Rohit_23",
  "avatar": "🦊"
}
```

The server responds with:
```json
{
  "type": "room_joined",
  "roomCode": "B4K8M",
  "role": "host",
  "playersCount": 1,
  "matchStatus": "arranging"
}
```

---

## 2. In-Match Game Events

### `lock_board` (Client → Server)
Confirms player's arranged 5×5 board:
```json
{
  "type": "lock_board",
  "board": [6, 18, 32, 47, 61, 8, 21, 37, 49, 63, 12, 25, 52, 65, 14, 27, 39, 56, 68, 15, 29, 44, 60, 72]
}
```

### `call_number` (Client → Server)
Called when it is player's turn:
```json
{
  "type": "call_number",
  "number": 18
}
```

Server broadcasts:
```json
{
  "type": "number_called",
  "number": 18,
  "callerId": "p_rohit23",
  "nextTurnPlayerId": "p_rival07",
  "turnSecondsRemaining": 45
}
```

### `claim_bingo` (Client → Server)
Authoritative victory claim once 5 lines are complete:
```json
{
  "type": "claim_bingo",
  "completedLines": 5
}
```

Server validates the claim against authoritative match called numbers and broadcasts:
```json
{
  "type": "bingo_result",
  "winnerId": "p_rohit23",
  "winnerName": "Rohit_23",
  "linesCompleted": 5,
  "coinsAwarded": 750,
  "diamondsAwarded": 20
}
```

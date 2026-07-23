# Alert Buddy Backend Server

Express.js backend server for Alert Buddy system with Firebase Cloud Messaging and Grafana integration.

## Features

- ✅ Firebase Cloud Messaging (FCM) for push notifications
- ✅ Device token management
- ✅ Standby/on-call rotation management
- ✅ Grafana Unified Alerting webhook receiver
- ✅ Alert broadcasting and routing
- ✅ Handover logging
- ✅ RESTful API

## Tech Stack

- **Node.js** + **TypeScript**
- **Express.js** - Web framework
- **Firebase Admin SDK** - FCM integration
- **CORS** - Cross-origin requests
- **dotenv** - Environment configuration

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Firebase service account key:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Copy the entire JSON content
6. Paste it into `.env` as `FIREBASE_SERVICE_ACCOUNT_KEY`

### 3. Start Server

```bash
# Development mode (with auto-reload)
npm run dev

# Or
npm run server:dev

# Production build
npm run build
npm start
```

Server runs on: **http://localhost:5000**

## API Endpoints

### Server Status

```bash
GET /api/status
```

Returns server health, Firebase status, standby info, and device count.

**Response:**
```json
{
  "status": "running",
  "firebase": "connected",
  "standby": {
    "onStandby": true,
    "email": "engineer@altron.com",
    "displayName": "John Doe",
    "tokenResolved": true,
    "updatedAt": 1234567890
  },
  "registeredDevices": 5,
  "uptime": "2h 15m"
}
```

### Device Management

#### Register Device
```bash
POST /api/devices/register
Content-Type: application/json

{
  "deviceId": "unique-device-id",
  "fcmToken": "firebase-cloud-messaging-token",
  "email": "user@altron.com"
}
```

#### Unregister Device
```bash
POST /api/devices/unregister
Content-Type: application/json

{
  "deviceId": "unique-device-id"
}
```

#### List All Devices
```bash
GET /api/devices
```

### Standby Management

#### Get Current Standby
```bash
GET /api/standby/current
```

#### Update Standby
```bash
POST /api/standby/update
Content-Type: application/json

{
  "email": "engineer@altron.com",
  "displayName": "John Doe",
  "updatedByEmail": "admin@altron.com"
}
```

#### Clear Standby
```bash
DELETE /api/standby
```

#### Get Handover History
```bash
GET /api/standby/history?limit=20
```

### Alert Sending

#### Send to All Devices
```bash
POST /api/alerts/send
Content-Type: application/json

{
  "title": "CPU Usage Critical",
  "message": "CPU at 97% on prod-server-01",
  "severity": "CRITICAL",
  "channelId": "infinity-dal-ms",
  "channelName": "Infinity DAL MS"
}
```

#### Send to Standby Person Only
```bash
POST /api/alerts/send-standby
Content-Type: application/json

{
  "title": "Database Connection Lost",
  "message": "PostgreSQL connection failed",
  "severity": "CRITICAL",
  "channelId": "nemo",
  "channelName": "Nemo"
}
```

#### Send to FCM Topic
```bash
POST /api/alerts/send-topic
Content-Type: application/json

{
  "topic": "all-engineers",
  "title": "System Maintenance",
  "message": "Scheduled maintenance in 1 hour",
  "severity": "INFO",
  "channelId": "general",
  "channelName": "General"
}
```

### Grafana Webhook

Requires HTTP Basic Auth. Set `GRAFANA_WEBHOOK_USER` / `GRAFANA_WEBHOOK_PASSWORD` in the
server environment and configure the same credentials as Basic Auth on the Grafana
contact point — requests without them are rejected with `401`, and the endpoint
returns `500` if the server-side env vars aren't set at all.

```bash
POST /api/grafana/webhook
Authorization: Basic base64(user:password)
Content-Type: application/json

{
  "receiver": "alert-buddy",
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "High CPU Usage",
        "severity": "critical",
        "instance": "prod-server-01",
        "grafana_folder": "infinity dal ms"
      },
      "annotations": {
        "summary": "CPU usage above threshold",
        "description": "CPU has been above 90% for 5 minutes"
      }
    }
  ]
}
```

## Channel Mapping

Grafana alerts are mapped to Alert Buddy channels based on labels:

| Grafana Label | Alert Buddy Channel |
|---------------|---------------------|
| `infinity dal ms` | Infinity DAL MS |
| `infinity online` | Infinity Online |
| `nemo` | Nemo |
| `online dal` | Online DAL |
| `vsa crisis` | VSA IT Crisis War Room |

**Priority order for label detection:**
1. `grafana_folder`
2. `channel`
3. `service`
4. `job`
5. `namespace`

**Default channel:** VSA IT Crisis War Room

## Severity Mapping

| Grafana Severity | Alert Buddy Severity |
|------------------|---------------------|
| `critical`, `high`, `error` | CRITICAL |
| `warning`, `warn`, `medium` | WARNING |
| `info`, `low`, `ok` | INFO |

## Testing

### Test Alert Sending

```bash
# Send test alert to all devices
curl -X POST http://localhost:5000/api/alerts/send \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Alert",
    "message": "This is a test alert from backend",
    "severity": "WARNING",
    "channelId": "test-channel",
    "channelName": "Test Channel"
  }'
```

### Test Grafana Webhook

```bash
curl -X POST http://localhost:5000/api/grafana/webhook \
  -u grafana:change-me \
  -H "Content-Type: application/json" \
  -d '{
    "receiver": "alert-buddy",
    "status": "firing",
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "Test Alert",
        "severity": "warning",
        "grafana_folder": "nemo"
      },
      "annotations": {
        "summary": "This is a test"
      }
    }]
  }'
```

## Project Structure

```
alert-buddy-backend/
├── server/
│   ├── index.ts              # Main server entry point
│   ├── routes.ts             # API route definitions
│   ├── fcm.ts                # Firebase Cloud Messaging
│   ├── device-storage.ts     # Device token management
│   ├── standby-storage.ts    # Standby state management
│   └── grafana.ts            # Grafana webhook parser
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Alert Routing Logic

1. **Grafana fires alert** → Webhook to `/api/grafana/webhook`
2. **Backend checks standby status:**
   - ✅ Someone on standby with token → Send to them
   - ❌ No one on standby → Broadcast to all devices
3. **FCM delivers notification** → Android app receives it
4. **App triggers alert** → User must acknowledge

## Configuration

### Environment Variables

- `PORT` - Server port (default: 5000)
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase service account JSON (required for FCM)
- `DATABASE_URL` - PostgreSQL connection string (optional, for future use)

### Firebase Setup

1. Create Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Cloud Messaging
3. Generate service account key
4. Add key to `.env`

## Production Deployment

### Option 1: Traditional VPS (Ubuntu)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <your-repo>
cd alert-buddy-backend
npm install
npm run build

# Use PM2 for process management
npm install -g pm2
pm2 start dist/server/index.js --name alert-buddy-backend
pm2 save
pm2 startup
```

### Option 2: Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["node", "dist/server/index.js"]
```

### Option 3: Cloud Platforms

- **Heroku:** Add `Procfile` with `web: node dist/server/index.js`
- **Vercel:** Add `vercel.json` with serverless config
- **Railway:** Connect GitHub repo, auto-deploy
- **Render:** Use Node.js service type

## Troubleshooting

### Firebase Not Connected

**Error:** `Firebase not initialized. Cannot send notification.`

**Solution:**
1. Check `.env` has `FIREBASE_SERVICE_ACCOUNT_KEY`
2. Verify JSON format is valid
3. Ensure service account has correct permissions

### No Devices Registered

**Error:** `No registered devices`

**Solution:**
1. Users must open mobile app and log in
2. Check app's `BackendApiService.kt` has correct URL
3. Verify network connectivity between app and backend

### Alerts Not Reaching Devices

**Checklist:**
- ✅ Backend shows "FCM sent successfully"
- ✅ Device is registered (check `/api/devices`)
- ✅ Token is valid and not expired
- ✅ Mobile app has notification permissions
- ✅ Device is not in Do Not Disturb mode
- ✅ Firebase project ID matches in app and backend

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::5000`

**Solution:**
```bash
# Find and kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or change PORT in .env
PORT=5001
```

## Development Tips

1. **Auto-reload:** `npm run dev` uses `tsx watch` for instant reloads
2. **Logging:** Check console for FCM status and errors
3. **Testing:** Use cURL or Postman for API testing
4. **Debug mode:** Add `console.log()` statements in routes

## Migration to Database

Currently uses in-memory storage. For production, migrate to PostgreSQL:

1. Create tables: `devices`, `standby`, `handover_logs`
2. Replace storage modules with database queries
3. Update environment with `DATABASE_URL`

## Support

For issues:
- Check backend console logs
- Verify Firebase configuration
- Test endpoints with cURL
- Review this README

---

# Run the Backend Server
backend
npm run dev

# Run the Frontend Server
frontend
npm run dev

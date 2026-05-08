import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as fcm from './fcm.js';
import routes from './routes.js';
import enhancedRoutes from './enhanced-features';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Initialize Firebase
fcm.initializeFirebase();

// Mount API routes
app.use('/api', routes);
app.use('/api', enhancedRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Alert Buddy Backend',
    version: '1.0.0',
    status: 'running',
    firebase: fcm.isFirebaseReady() ? 'connected' : 'disabled',
    endpoints: {
      status: 'GET /api/status',
      devices: 'GET /api/devices',
      registerDevice: 'POST /api/devices/register',
      unregisterDevice: 'POST /api/devices/unregister',
      currentStandby: 'GET /api/standby/current',
      updateStandby: 'POST /api/standby/update',
      clearStandby: 'DELETE /api/standby',
      handoverHistory: 'GET /api/standby/history',
      sendAlert: 'POST /api/alerts/send',
      sendStandbyAlert: 'POST /api/alerts/send-standby',
      sendTopicAlert: 'POST /api/alerts/send-topic',
      grafanaWebhook: 'POST /api/grafana/webhook',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║   🚀 Alert Buddy Backend Server               ║');
    console.log('╚═══════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ Firebase: ${fcm.isFirebaseReady() ? 'Connected ✓' : 'Disabled ⚠️'}`);
    console.log('');
    console.log('📡 API Endpoints:');
    console.log(`   GET  http://localhost:${PORT}/api/status`);
    console.log(`   POST http://localhost:${PORT}/api/grafana/webhook`);
    console.log(`   POST http://localhost:${PORT}/api/alerts/send`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
  });
}

export default app;

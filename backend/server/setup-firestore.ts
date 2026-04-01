import admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountKey) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not found in .env');
    process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountKey);

if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function setupFirestore() {
    console.log('🔥 Setting up Firestore collections...\n');

    try {
        // 1. Create users collection
        console.log('📝 Creating users collection...');
        await db.collection('users').add({
            email: 'mpumelelo.magagula@altron.com',
            displayName: 'Mpumelelo Magagula',
            role: 'ADMIN',
            position: 'DevOps Engineer & Founder',
            department: 'InfinityWork IT Solutions',
            phoneNumber: '',
            isActive: true,
            createdAt: Date.now(),
        });
        console.log('✅ Users collection created\n');

        // 2. Create team_members collection
        console.log('📝 Creating team_members collection...');
        await db.collection('team_members').add({
            email: 'mpumelelo.magagula@altron.com',
            displayName: 'Mpumelelo Magagula',
            role: 'ADMIN',
            standbyStatus: 'AVAILABLE',
            phoneNumber: '',
            createdAt: Date.now(),
            isCurrentUser: false,
        });
        console.log('✅ Team members collection created\n');

        // 3. Create alerts collection with sample alert
        console.log('📝 Creating alerts collection...');
        await db.collection('alerts').add({
            title: 'Welcome to Alert Buddy',
            body: 'System is ready for critical infrastructure alerting. All components operational.',
            severity: 'INFO',
            channelId: 'general',
            channelName: 'General',
            timestamp: Date.now(),
            isRead: false,
            source: 'System',
        });
        console.log('✅ Alerts collection created\n');

        // 4. Create handover_logs collection
        console.log('📝 Creating handover_logs collection...');
        await db.collection('handover_logs').add({
            fromUserId: 'system',
            fromUserName: 'System',
            toUserId: 'mpumelelo.magagula@altron.com',
            toUserName: 'Mpumelelo Magagula',
            handoverAt: Date.now(),
            notes: 'Initial system setup - First administrator assigned',
            pendingAlertsCount: 0,
        });
        console.log('✅ Handover logs collection created\n');

        console.log('🎉 Firestore setup complete!');
        console.log('\nCollections created:');
        console.log('  ✅ users');
        console.log('  ✅ team_members');
        console.log('  ✅ alerts');
        console.log('  ✅ handover_logs');
        console.log('\nYou can now refresh your web portal and everything should work!');
        console.log('Visit: http://localhost:3000\n');
    } catch (error) {
        console.error('❌ Error setting up Firestore:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Run setup
setupFirestore();
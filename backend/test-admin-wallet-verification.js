const axios = require('axios');

const API_BASE = 'http://localhost:5000/api/v1';

// Generate random details to avoid conflicts
const timestamp = Date.now();
const adminDetails = {
    firstName: 'Test',
    lastName: 'Admin',
    mobile: '9' + timestamp.toString().substring(4), // 10 digits
    email: `testadmin${timestamp}@example.com`,
    password: 'password123',
    role: 'Admin'
};

async function runTest() {
    try {
        console.log('🚀 Starting Admin Wallet Verification Test...\n');

        // 1. Register Admin
        console.log(`1️⃣  Registering Test Admin (${adminDetails.email})...`);
        const registerRes = await axios.post(`${API_BASE}/auth/admin/register`, adminDetails);
        const token = registerRes.data.data.token;
        console.log('✅ Admin Registered. Token received.');

        const headers = { Authorization: `Bearer ${token}` };

        // 2. Fetch Initial Earnings
        console.log('\n2️⃣  Fetching Initial Admin Earnings...');
        const initialEarningsRes = await axios.get(`${API_BASE}/admin/wallet/earnings?limit=1`, { headers });
        const initialTotal = initialEarningsRes.data.pagination.total;
        console.log(`✅ Initial Earnings Total: ${initialTotal}`);

        // 3. Find an Order to Update
        console.log('\n3️⃣  Fetching Orders to find a candidate...');
        const ordersRes = await axios.get(`${API_BASE}/admin/orders?limit=50`, { headers });
        const orders = ordersRes.data.data;

        const candidateOrder = orders.find(o => o.status !== 'Delivered' && o.status !== 'Cancelled' && o.items && o.items.length > 0);

        if (!candidateOrder) {
            console.log('⚠️  No suitable active orders (with items) found to update.');
            return;
        }

        console.log(`✅ Found Candidate Order: ${candidateOrder.orderNumber}`);
        console.log(`   Status: ${candidateOrder.status}`);
        console.log(`   Items: ${candidateOrder.items.length}`);
        console.log(`   Total: ${candidateOrder.total}`);
        if (candidateOrder.items.length > 0) {
            console.log(`   First Item ID: ${candidateOrder.items[0]._id}`);
            // If items are populated, we can see if they have product/seller
            // But admin/orders endpoint might not populate deeply enough?
            // Let's check a raw item if possible or assumption
        }

        // 4. Update Order to Delivered
        console.log(`\n4️⃣  Updating Order ${candidateOrder.orderNumber} to 'Delivered'...`);
        try {
            const updateRes = await axios.patch(`${API_BASE}/admin/orders/${candidateOrder._id}/status`, {
                status: 'Delivered',
                adminNotes: 'Automated test update'
            }, { headers });
            console.log('✅ Order Status Updated.');
        } catch (updateErr) {
            console.log('❌ Failed to update status:', updateErr.response?.data || updateErr.message);
            return;
        }

        // 5. Verify Earnings Increased
        console.log('\n5️⃣  Verifying Earnings Update...');
        // Wait a bit just in case async operations take time (though distributeCommissions is awaited in controller now)
        await new Promise(r => setTimeout(r, 2000));

        const finalEarningsRes = await axios.get(`${API_BASE}/admin/wallet/earnings?limit=1`, { headers });
        const finalTotal = finalEarningsRes.data.pagination.total;

        console.log(`✅ Final Earnings Total: ${finalTotal}`);

        if (finalTotal > initialTotal) {
            console.log(`🎉 SUCCESS! Earnings total increased from ${initialTotal} to ${finalTotal}.`);

            // Fetch the latest to show details
            const latestRes = await axios.get(`${API_BASE}/admin/wallet/earnings?page=1&limit=5`, { headers });
            const newEarning = latestRes.data.data.find(e => e.description.includes(candidateOrder.orderNumber));
            if (newEarning) {
                console.log(`   Found new earning record details:`);
                console.log(JSON.stringify(newEarning, null, 2));
            }
        } else {
            console.log('❌ FAILURE: Earnings count did not increase. Commission might not have been generated.');
            console.log('Possible reasons:');
            console.log(' - Order was already processed?');
            console.log(' - Commission service logic failure.');
            console.log(' - Order had no items/sellers?');
        }

    } catch (error) {
        if (error.response) {
            console.log(`❌ Request Failed: ${error.response.status} ${error.response.statusText}`);
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('❌ Error:', error.message);
        }
    }
}

runTest();

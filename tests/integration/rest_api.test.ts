import assert from 'assert';

const API_BASE_URL = 'http://localhost:3000/api';

async function testChatEndpoint() {
    console.log('Testing POST /api/chat...');
    
    // Test 1: Missing userId
    try {
        const res1 = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Hello' })
        });
        assert.strictEqual(res1.status, 400, 'Should reject missing userId');
        console.log('   ✓ Rejects missing userId');
    } catch (error: any) {
        console.error('   ✗ Failed:', error.message);
        throw error;
    }

    // Test 2: Valid message (requires auth token)
    try {
        const res2 = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-auth-token': 'test_token'
            },
            body: JSON.stringify({ 
                message: 'Hello', 
                userId: 'test_user' 
            })
        });
        assert.ok(res2.headers.get('content-type')?.includes('application/json'), 
            'Should return JSON');
        console.log('   ✓ Processes valid message');
    } catch (error: any) {
        console.error('   ✗ Failed:', error.message);
        throw error;
    }
}

async function runTests() {
    console.log('Running REST API Integration Tests...\n');
    
    try {
        await testChatEndpoint();
        console.log('\nAll REST API tests passed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\nTest Failed:', error);
        process.exit(1);
    }
}

runTests();

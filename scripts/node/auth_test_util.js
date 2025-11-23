import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';
const TEST_USERNAME = `testuser_${Date.now()}`;
const TEST_EMAIL = `testuser_${Date.now()}@example.com`;
const TEST_PASSWORD = 'testpassword123';

export async function registerAndLogin() {
    try {
        console.log('Attempting to register a new user...');
        const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, {
            username: TEST_USERNAME,
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
        });
        console.log('Registration successful:', registerResponse.data);
        const registeredUserId = registerResponse.data.userId;

        console.log('\nAttempting to log in the new user...');
        const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
            loginIdentifier: TEST_EMAIL, // Can use email or username
            password: TEST_PASSWORD,
        });
        console.log('Login successful:', loginResponse.data);
        const { token, user } = loginResponse.data;
        const loggedInUserId = user.userId;

        console.log('\n--- User Details ---');
        console.log('Registered User ID:', registeredUserId);
        console.log('Logged In User ID:', loggedInUserId);
        console.log('Auth Token:', token);
        console.log('--------------------');

        return { userId: loggedInUserId, token };

    } catch (error) {
        if (error.response) {
            console.error('API Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
}


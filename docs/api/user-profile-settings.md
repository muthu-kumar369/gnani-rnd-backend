# User Profile & Settings API Documentation

## Base URL
All endpoints are prefixed with `/api/user` and require authentication via JWT token in the `Authorization` header.

```
Authorization: Bearer <your-jwt-token>
```

---

## Profile Management

### Get User Profile
Retrieve the current user's profile information.

**Endpoint:** `GET /api/user/profile`

**Response:**
```json
{
  "userId": "string",
  "username": "string",
  "email": "string",
  "roles": ["string"],
  "permissions": ["string"],
  "profile": {
    "firstName": "string",
    "lastName": "string",
    "dob": "ISO8601 date",
    "locale": "string",
    "language": "string",
    "profilePhoto": "string (URL)"
  },
  "preferences": {},
  "isActive": true,
  "isOnboarded": true,
  "createdAt": "ISO8601 date",
  "updatedAt": "ISO8601 date",
  "lastLoginAt": "ISO8601 date"
}
```

### Update User Profile
Update user profile information.

**Endpoint:** `PUT /api/user/profile`

**Request Body:**
```json
{
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "dob": "ISO8601 date (optional)",
  "locale": "string (optional)",
  "language": "string (optional)",
  "profilePhoto": "string URL (optional)"
}
```

**Response:**
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "firstName": "string",
    "lastName": "string",
    "dob": "ISO8601 date",
    "locale": "string",
    "language": "string",
    "profilePhoto": "string"
  }
}
```

---

## Settings Management

### Get User Settings
Retrieve user settings and preferences.

**Endpoint:** `GET /api/user/settings`

**Response:**
```json
{
  "settings": {
    "wakeWord": "string",
    "preferredVoice": "string",
    "volume": 0.0-1.0,
    "theme": "string",
    "shortcuts": {}
  },
  "preferences": {}
}
```

### Update User Settings
Update user settings and preferences.

**Endpoint:** `PUT /api/user/settings`

**Request Body:**
```json
{
  "settings": {
    "wakeWord": "string (optional)",
    "preferredVoice": "string (optional)",
    "volume": 0.0-1.0 (optional),
    "theme": "string (optional)",
    "shortcuts": {} (optional)
  },
  "preferences": {} (optional)
}
```

**Response:**
```json
{
  "message": "Settings updated successfully",
  "settings": {
    "wakeWord": "string",
    "preferredVoice": "string",
    "volume": 0.0-1.0,
    "theme": "string",
    "shortcuts": {}
  }
}
```

---

## Device Management

### Get User Devices
List all devices associated with the user.

**Endpoint:** `GET /api/user/devices`

**Response:**
```json
[
  {
    "deviceId": "string",
    "deviceName": "string",
    "deviceType": "string",
    "lastActive": "ISO8601 date",
    "isActive": true
  }
]
```

### Add Device
Register a new device.

**Endpoint:** `POST /api/user/devices`

**Request Body:**
```json
{
  "deviceId": "string",
  "deviceName": "string",
  "deviceType": "string"
}
```

**Response:**
```json
{
  "message": "Device added successfully",
  "devices": [...]
}
```

### Update Device
Update device information.

**Endpoint:** `PUT /api/user/devices/:deviceId`

**Request Body:**
```json
{
  "deviceName": "string (optional)",
  "deviceType": "string (optional)",
  "isActive": true/false (optional)
}
```

**Response:**
```json
{
  "message": "Device updated successfully",
  "devices": [...]
}
```

### Remove Device
Remove a device from the user's account.

**Endpoint:** `DELETE /api/user/devices/:deviceId`

**Response:**
```json
{
  "message": "Device removed successfully",
  "devices": [...]
}
```

---

## Security Management

### Get Security Information
Retrieve user security settings.

**Endpoint:** `GET /api/user/security`

**Response:**
```json
{
  "mfaEnabled": true/false,
  "recoveryEmail": "string",
  "lastPasswordChange": "ISO8601 date"
}
```

### Update Security Settings
Update security settings like MFA and recovery email.

**Endpoint:** `PUT /api/user/security`

**Request Body:**
```json
{
  "mfaEnabled": true/false (optional),
  "recoveryEmail": "string (optional)"
}
```

**Response:**
```json
{
  "message": "Security info updated successfully",
  "security": {
    "mfaEnabled": true/false,
    "recoveryEmail": "string"
  }
}
```

---

## OAuth Provider Management

### Get OAuth Providers
List all linked OAuth providers.

**Endpoint:** `GET /api/user/oauth`

**Response:**
```json
[
  {
    "provider": "google|facebook|github",
    "providerId": "string",
    "email": "string",
    "linkedAt": "ISO8601 date"
  }
]
```

### Unlink OAuth Provider
Remove a linked OAuth provider.

**Endpoint:** `DELETE /api/user/oauth/:provider`

**URL Parameters:**
- `provider`: The OAuth provider name (e.g., "google", "facebook", "github")

**Response:**
```json
{
  "message": "OAuth provider unlinked successfully",
  "providers": [...]
}
```

---

## History Management

### Get Activity History
Retrieve user's activity history.

**Endpoint:** `GET /api/user/history`

**Response:**
```json
[
  {
    "_id": "string",
    "action": "string",
    "timestamp": "ISO8601 date",
    "details": {}
  }
]
```

### Delete History Item
Delete a specific history item.

**Endpoint:** `DELETE /api/user/history/:id`

**URL Parameters:**
- `id`: The history item ID

**Response:**
```json
{
  "message": "History item deleted successfully",
  "history": [...]
}
```

### Clear All History
Clear all user history.

**Endpoint:** `DELETE /api/user/history`

**Response:**
```json
{
  "message": "History cleared successfully"
}
```

---

## Notes Management

### Get User Notes
Retrieve all user notes.

**Endpoint:** `GET /api/user/notes`

**Response:**
```json
[
  "Note 1 text",
  "Note 2 text",
  "Note 3 text"
]
```

### Add Note
Add a new note.

**Endpoint:** `POST /api/user/notes`

**Request Body:**
```json
{
  "note": "string"
}
```

**Response:**
```json
{
  "message": "Note added successfully",
  "notes": [...]
}
```

### Delete Note
Delete a note by index.

**Endpoint:** `DELETE /api/user/notes/:index`

**URL Parameters:**
- `index`: The zero-based index of the note to delete

**Response:**
```json
{
  "message": "Note deleted successfully",
  "notes": [...]
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "User not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Error description"
}
```

---

## Frontend Integration Examples

### JavaScript/TypeScript (Fetch API)

```typescript
// Get user profile
async function getUserProfile() {
  const response = await fetch('/api/user/profile', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
}

// Update profile
async function updateProfile(profileData) {
  const response = await fetch('/api/user/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(profileData)
  });
  return await response.json();
}

// Remove device
async function removeDevice(deviceId) {
  const response = await fetch(`/api/user/devices/${deviceId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
}
```

### Axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/user',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Get settings
const settings = await api.get('/settings');

// Update settings
const updated = await api.put('/settings', {
  settings: { theme: 'dark', volume: 0.8 }
});

// Clear history
await api.delete('/history');
```

---

## Notes

- All endpoints require valid JWT authentication
- Timestamps are in ISO 8601 format
- All requests and responses use JSON format
- Partial updates are supported (only send fields you want to update)
- Array responses may be empty if no data exists

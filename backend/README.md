# BATU Alumni Connect - Backend

Backend server for BATU Alumni Connect platform with Node.js, Express, and PostgreSQL.

## Features

- User Registration with approval workflow
- Admin Panel for user verification
- JWT-based Authentication
- Role-based Access Control (User & Admin)
- PostgreSQL Database
- RESTful API

## Prerequisites

- Node.js >= 14.0
- PostgreSQL >= 12
- npm

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Edit `.env`:
```
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=batu_alumni
```

### 3. Create PostgreSQL Database

```bash
createdb batu_alumni
```

Or using psql:
```sql
CREATE DATABASE batu_alumni;
```

### 4. Initialize Database Schema

```bash
npm run setup:db
```

This will:
- Create all required tables
- Create default admin user

**Default Admin Credentials:**
- Email: `admin@batu-alumni.com`
- Password: `Admin@123`

## Running the Server

### Development (with auto-reload)

```bash
npm run dev
```

### Production

```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication Routes `/api/auth`

#### Register User
```
POST /api/auth/register
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john@example.com",
  "mobileNumber": "+91 9876543210",
  "branch": "Electronics",
  "passportYear": 2026,
  "currentCity": "Mumbai",
  "linkedIn": "https://linkedin.com/in/john",
  "jobType": "Service",
  "sector": "IT",
  "company": "TCS",
  "designation": "Software Engineer",
  "yearsOfExperience": 3,
  "skills": ["Java", "React"]
}
```

**Response (201):**
```json
{
  "message": "Registration successful. Awaiting admin approval.",
  "user": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "status": "pending_approval"
  }
}
```

#### User Login
```
POST /api/auth/login
Content-Type: application/json

{
  "loginId": "USER_LOGIN_ID",
  "password": "USER_PASSWORD"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "john@example.com"
  }
}
```

#### Admin Login
```
POST /api/auth/admin-login
Content-Type: application/json

{
  "email": "admin@batu-alumni.com",
  "password": "Admin@123"
}
```

### Admin Routes `/api/admin` (Requires Admin Token)

#### Get Pending Users
```
GET /api/admin/pending-users
Authorization: Bearer <admin_token>
```

#### Get Approved Users
```
GET /api/admin/approved-users
Authorization: Bearer <admin_token>
```

#### Approve User
```
POST /api/admin/approve-user/:userId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "remarks": "User information verified"
}
```

**Response:**
```json
{
  "message": "User approved successfully",
  "credentials": {
    "loginId": "generated_login_id",
    "password": "generated_password",
    "note": "Please securely send these credentials to the user"
  },
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

#### Reject User
```
POST /api/admin/reject-user/:userId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "remarks": "Documents not verified"
}
```

#### Get User Details
```
GET /api/admin/user-details/:userId
Authorization: Bearer <admin_token>
```

#### Get Verification Logs
```
GET /api/admin/verification-logs/:userId
Authorization: Bearer <admin_token>
```

#### Get Dashboard Stats
```
GET /api/admin/stats
Authorization: Bearer <admin_token>
```

### User Routes `/api/users` (Requires User Token)

#### Get Profile
```
GET /api/users/profile
Authorization: Bearer <user_token>
```

#### Update Profile
```
PUT /api/users/profile
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "fullName": "Jane Doe",
  "mobileNumber": "+91 9876543210",
  "currentCity": "Delhi"
}
```

#### Get Status
```
GET /api/users/status
Authorization: Bearer <user_token>
```

## Database Schema

### Users Table
```sql
- id (UUID, Primary Key)
- full_name (VARCHAR)
- email (VARCHAR, UNIQUE)
- mobile_number (VARCHAR)
- branch (VARCHAR)
- passport_year (INTEGER)
- current_city (VARCHAR)
- linkedin_profile (VARCHAR)
- job_type (VARCHAR)
- sector (VARCHAR)
- company_name (VARCHAR)
- designation (VARCHAR)
- years_of_experience (INTEGER)
- skills (TEXT[])
- id_proof_url (VARCHAR)
- status (VARCHAR: pending_approval, approved, rejected)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### User Auth Table
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- password_hash (VARCHAR)
- login_id (VARCHAR, UNIQUE)
- generated_password (VARCHAR)
- is_login_enabled (BOOLEAN)
- last_login_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Admin Users Table
```sql
- id (UUID, Primary Key)
- email (VARCHAR, UNIQUE)
- password_hash (VARCHAR)
- name (VARCHAR)
- role (VARCHAR)
- is_active (BOOLEAN)
- last_login_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## Error Handling

All errors are returned as JSON:

```json
{
  "error": "Error message",
  "status": 400
}
```

Common HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

## Security

- Passwords are hashed using bcryptjs
- JWT tokens are used for authentication
- Admin routes are protected with authentication middleware
- Environment variables store sensitive data

## Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Check `.env` database credentials
- Verify database exists

### Port Already in Use
```bash
# On Windows
netstat -ano | findstr :<PORT>
taskkill /PID <PID> /F

# On Linux/Mac
lsof -i :<PORT>
kill -9 <PID>
```

## Future Enhancements

- Email notifications for user registration/approval
- File upload for ID verification
- Two-factor authentication
- Admin audit logs
- User search and filtering
- Email templates for communications
- Rate limiting
- API versioning

## License

ISC

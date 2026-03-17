# Alumni Connect - Web Application

A responsive web application for BATU Alumni Connect, built with React, TypeScript, and Vite.

## Features

- 🎓 **Alumni Feed** - Share updates, posts, and engage with the community
- 👥 **Network** - Connect with alumni, send connection requests
- 💼 **Opportunities** - Browse and post job openings, internships, and mentorship opportunities
- 💬 **Real-time Messaging** - Chat with your connections using Socket.IO
- 👤 **Profile Management** - Update your profile, skills, and professional information
- 🎫 **Help Desk** - Submit and track support tickets
- 🔐 **Secure Authentication** - JWT-based authentication with token refresh

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Real-time**: Socket.IO Client
- **Styling**: CSS with responsive design
- **HTTP Client**: Native Fetch API

## Prerequisites

- Node.js 16+ and npm/yarn
- Backend server running (see backend folder)

## Installation

1. Navigate to the web directory:
   ```bash
   cd web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration:
   ```
   VITE_API_URL=http://localhost:5000
   VITE_DEMO_MODE=false
   ```

## Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Building for Production

Build the application:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```
web/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Layout.tsx
│   ├── contexts/            # React contexts
│   │   └── AuthContext.tsx
│   ├── pages/               # Page components
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── FeedPage.tsx
│   │   ├── NetworkPage.tsx
│   │   ├── OpportunitiesPage.tsx
│   │   ├── MessagesPage.tsx
│   │   ├── ProfilePage.tsx
│   │   ├── HelpDeskPage.tsx
│   │   └── AdminPage.tsx
│   ├── services/            # API and service layer
│   │   ├── api.client.ts
│   │   └── socket.service.ts
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   ├── theme.ts             # Theme configuration
│   └── index.css            # Global styles
├── public/                  # Static assets
├── index.html               # HTML template
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies and scripts
```

## Features by Page

### Home Page
- Landing page with feature showcase
- Call-to-action buttons for login/register

### Login/Register
- User authentication
- Form validation
- Demo credentials display

### Feed
- Create posts with text and images
- Like and comment on posts
- Real-time updates via WebSockets
- Delete your own posts

### Network
- Discover alumni
- Send/receive connection requests
- View connections
- Filter by branch and graduation year

### Opportunities
- Browse job openings, internships, mentorships
- Post new opportunities
- Filter by opportunity type

### Messages
- Real-time messaging
- Conversation list
- Message history
- Unread message indicators

### Profile
- View and edit profile information
- Upload profile picture
- Display educational and professional details
- Social media links

### Help Desk
- Submit support tickets
- Track ticket status
- View ticket history

### Admin Dashboard
- View platform statistics
- Manage users
- Send broadcast notifications
- Admin-only access

## Responsive Design

The application is fully responsive and works seamlessly on:
- 📱 Mobile devices (< 768px)
- 📱 Tablets (768px - 1024px)
- 💻 Desktops (> 1024px)

## API Integration

The web app uses the same backend API as the mobile app. All API calls are handled through the `api.client.ts` service:

- Automatic token refresh
- Error handling
- Type-safe responses

## Socket.IO Integration

Real-time features are powered by Socket.IO:

- New messages
- Feed updates
- Notifications
- Connection requests

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | http://localhost:5000 |
| VITE_DEMO_MODE | Enable demo mode | false |

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Security

- JWT-based authentication
- Secure token storage in localStorage
- Automatic token refresh
- Protected routes
- Input validation

## Performance

- Code splitting with React Router
- Lazy loading of images
- Optimized bundle size with Vite
- CSS minification

## Deployment

### Option 1: Static Hosting (Netlify, Vercel)

1. Build the application:
   ```bash
   npm run build
   ```

2. Deploy the `dist` folder to your hosting provider

3. Configure environment variables in your hosting dashboard

### Option 2: Docker

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Demo Credentials

**Regular User:**
- Email: demo@batu.edu
- Password: demo123

**Admin:**
- Email: admin@batu-alumni.com
- Password: Admin@123

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please use the Help Desk feature within the application or contact the development team.

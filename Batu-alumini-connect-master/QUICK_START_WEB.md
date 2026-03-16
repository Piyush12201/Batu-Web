# Quick Start Guide - Web Application

Get your Alumni Connect web application up and running in 5 minutes!

## Prerequisites

- Node.js 16 or higher
- npm or yarn
- Backend server (already set up in your project)

## Step 1: Start the Backend Server

```bash
# Navigate to backend directory
cd backend

# Install dependencies (if not already done)
npm install

# Start the backend server
npm start
```

✅ Backend should be running on `http://localhost:5000`

## Step 2: Setup Web Application

```bash
# Navigate to web directory
cd web

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# The .env file is already configured for local development
# It should contain: VITE_API_URL=http://localhost:5000
```

## Step 3: Start Web Application

```bash
# Start development server
npm run dev
```

✅ Web app should open automatically at `http://localhost:3000`

## Step 4: Test the Application

### Login with Demo Credentials

**Regular User:**
- Email: `demo@batu.edu`
- Password: `demo123`

**Admin:**
- Email: `admin@batu-alumni.com`
- Password: `Admin@123`

## Test Features

After logging in, try these features:

1. **Feed Page** - Create a post, like and comment
2. **Network Page** - Browse alumni and send connection requests
3. **Opportunities Page** - Browse job postings
4. **Messages Page** - Start a conversation
5. **Profile Page** - Edit your profile and upload a picture
6. **Help Desk Page** - Create a support ticket
7. **Admin Panel** (admin login only) - View statistics and manage users

## Project Structure

```
Batu-alumini-connect-master/
├── backend/              # Backend API (Node.js + Express)
│   ├── server.js
│   ├── routes/
│   └── ...
├── web/                  # NEW! Web Application (React + Vite)
│   ├── src/
│   │   ├── pages/       # All page components
│   │   ├── components/  # Reusable components
│   │   ├── services/    # API and Socket services
│   │   └── ...
│   ├── package.json
│   └── vite.config.ts
└── alumini-connect/     # Original Mobile App (React Native)
    └── ...
```

## Common Commands

### Development
```bash
cd web
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Backend
```bash
cd backend
npm start            # Start backend server
npm run dev          # Start with nodemon (auto-reload)
```

## Responsive Testing

The web app is fully responsive. Test on:

**Desktop:** Open in browser at full screen
**Tablet:** Resize browser to ~768px width
**Mobile:** Resize browser to ~375px width or use DevTools device emulation

### DevTools Device Emulation:
1. Press `F12` to open DevTools
2. Click the device toolbar icon (or `Ctrl+Shift+M`)
3. Select a device (iPhone, iPad, etc.)

## Features Overview

### 🎓 Alumni Feed
- Create posts with text and images
- Like and comment on posts
- Real-time updates
- Delete your posts

### 👥 Network
- Discover alumni by branch/year
- Send connection requests
- Manage connections
- View alumni profiles

### 💼 Opportunities
- Browse jobs, internships, mentorships
- Post opportunities
- Filter by type

### 💬 Messages
- Real-time chat
- Conversation history
- Message notifications

### 👤 Profile
- Edit personal information
- Upload profile picture
- Add social links
- Update professional details

### 🎫 Help Desk
- Submit support tickets
- Track ticket status

### 🔐 Admin Panel
- View platform statistics
- Manage users
- Send broadcast messages

## Troubleshooting

### Backend Connection Issues

**Problem:** "Failed to fetch" errors

**Solution:**
1. Make sure backend is running (`npm start` in backend folder)
2. Check backend is on port 5000
3. Verify `.env` file has `VITE_API_URL=http://localhost:5000`

### Port Already in Use

**Problem:** "Port 3000 is already in use"

**Solution:**
```bash
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or change port in web app
# Edit vite.config.ts and set a different port
```

### Images Not Loading

**Problem:** Uploaded images don't display

**Solution:**
1. Check backend `uploads/` folder exists and has write permissions
2. Verify backend is serving static files
3. Check image URLs in console

### Socket.IO Connection Failed

**Problem:** Real-time features not working

**Solution:**
1. Check backend Socket.IO setup
2. Verify token is valid
3. Check browser console for socket errors

## Browser Requirements

The web app works on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Production Deployment

### Build for Production

```bash
cd web
npm run build
```

This creates a `dist/` folder with optimized static files.

### Deploy Options

1. **Netlify** (Recommended)
   - Connect your Git repository
   - Build command: `npm run build`
   - Publish directory: `dist`

2. **Vercel**
   - Import project from Git
   - Auto-detected as Vite project
   - Deploy with one click

3. **Traditional Server**
   - Upload `dist/` folder to web server
   - Configure nginx/Apache to serve files
   - Set up reverse proxy for API

## Next Steps

📚 **Read the full documentation:**
- `web/README.md` - Detailed web app documentation
- `WEB_CONVERSION_GUIDE.md` - Technical conversion details

🎨 **Customize the app:**
- Edit `src/theme.ts` - Change colors and styles
- Modify `src/pages/` - Update page layouts
- Update `public/` - Add your logo and favicon

🚀 **Deploy to production:**
- Follow deployment guide in `web/README.md`
- Update environment variables for production
- Set up SSL certificate for HTTPS

## Support

Having issues? Check:
1. Console errors in browser DevTools
2. Backend logs in terminal
3. Network tab for failed requests

## Success Checklist

- ✅ Backend running on port 5000
- ✅ Web app running on port 3000
- ✅ Can login with demo credentials
- ✅ Can create and view posts
- ✅ Sidebar navigation works
- ✅ Responsive on mobile/tablet/desktop

## Congratulations! 🎉

Your Alumni Connect web application is now running. Both the mobile app and web app can run simultaneously using the same backend!

**Happy coding!** 💻

# BATU Alumni Connect - Detailed System Documentation

Generated on: 2026-03-09
Workspace root: `c:\Users\HP\OneDrive\Desktop\Bhatu-Alumini-App`

## 1. What This Project Is
This is a full-stack alumni networking platform with:
- A React Native + Expo client in `alumini-connect/` (mobile + web).
- A Node.js + Express + PostgreSQL + Socket.IO backend in `backend/`.
- Redis used for cache, online presence, and queue backing.
- Bull queues for background notification/feed jobs.
- Cloudinary (optional) and local storage fallback for image uploads.

Primary product areas:
- Authentication and admin approval workflow.
- Feed (posts, likes, comments, saves, shares, trending).
- Messaging (conversations, read/delivery states, typing, connected users).
- Notifications.
- Network discovery and connect/disconnect.
- Opportunities + applications/bookmarks.
- Help Desk (ask/offer posts and responses).
- Admin dashboard (pending approvals, reports, broadcasts).

## 2. Repository Structure and Roles
- `alumini-connect/`: Expo app, UI screens, API clients, socket client, hooks.
- `backend/`: Express API server, sockets, middleware, route handlers, DB setup/migrations.
- `backend/database/init.js`: base schema bootstrap.
- `backend/database/migrate.js`: schema evolution, indexes, additional feature columns/tables.
- `load-tests/`: k6 scripts.
- `nginx/nginx.conf`: reverse proxy config (deployment-related).

## 3. Runtime Architecture
## 3.1 Client (Expo)
- Entry and navigation state machine in `alumini-connect/App.tsx`.
- No React Navigation package used; screen switching is done via internal `currentScreen` state.
- Tokens persisted in AsyncStorage and attached to API calls.
- Real-time events handled by Socket.IO client (`alumini-connect/services/socket.service.ts`).

## 3.2 Server (Express)
- Server bootstrap in `backend/server.js`.
- HTTP and Socket.IO share same Node server instance.
- Middleware stack includes Helmet, compression, cookie-parser, request logging, CORS, sanitization, metrics, and rate limiting.
- Route groups mounted under `/api/*`.

## 3.3 Data/Infrastructure
- PostgreSQL via `pg` pool (`backend/config/database.js`).
- Redis via ioredis (`backend/config/redis.js`) with graceful degraded behavior when Redis is unavailable.
- Bull queues (`backend/services/queue.service.js`) for async work.
- Image media service (`backend/services/media.service.js`) supports Cloudinary or local upload folder fallback.

## 4. Frontend Application Design
## 4.1 Screen Flow (`alumini-connect/App.tsx`)
Main states:
- Public: `home`, `login`, `register`, `adminLogin`.
- Authenticated: `feed`, `activity`, `network`, `opportunities`, `helpdesk`, `messages`, `profile`, `userProfile`.
- Admin: `admin`.

Login bootstrap flow:
1. Read `accessToken` from AsyncStorage.
2. `apiClient.setToken(token)`.
3. `apiClient.getCurrentUser()` to validate session.
4. If valid: mark logged-in, connect socket, fetch unread counts.
5. If invalid: clear tokens.

Logout flow:
1. Try backend logout.
2. Clear tokens (storage + in-memory).
3. Disconnect socket.
4. Reset UI state and unread counters.

## 4.2 Two API Layers (Important)
There are two active frontend API modules:
- `alumini-connect/services/api.client.ts`: class-based client, refresh-token retry logic, used heavily by feed/messaging/activity and app shell.
- `alumini-connect/api.ts`: function-based API helpers, used by admin/network/opportunities/helpdesk/profile and parts of login/messaging.

This dual-client architecture is a key implementation detail and source of response-shape handling differences across screens.

## 4.3 Screen-to-API Wiring
`ActivityFeedScreen.tsx`
- `apiClient.getNotifications()` -> `GET /api/notifications`
- `apiClient.markNotificationAsRead(id)` -> `PUT /api/notifications/:id/read`
- `apiClient.markAllNotificationsAsRead()` -> `PUT /api/notifications/read-all`

`FeedScreen.tsx`
- `apiClient.getCurrentUser()` -> `GET /api/auth/me`
- `apiClient.getPosts()` -> `GET /api/feed/posts`
- `apiClient.uploadPostImage()` -> `POST /api/upload/post-image`
- `apiClient.createPost()` -> `POST /api/feed/posts`
- `apiClient.likePost()/unlikePost()` -> `POST /api/feed/posts/:id/like|unlike`
- `apiClient.getComments()/addComment()` -> `GET|POST /api/feed/posts/:id/comments`
- `apiClient.deletePost()` -> `DELETE /api/feed/posts/:id`

`MessagingScreen.tsx`
- `apiClient.getCurrentUser()` -> `GET /api/auth/me`
- `apiClient.getConversations()` -> `GET /api/messages/conversations`
- `apiClient.getConnectedUsers()` -> `GET /api/messages/connected-users`
- `apiClient.getMessages(userId)` -> `GET /api/messages/with/:userId`
- `apiClient.sendMessage()` -> `POST /api/messages/send`
- `apiClient.markMessageAsRead()` -> `PUT /api/messages/:id/read`
- `API.getBroadcasts()` -> `GET /api/admin/broadcasts` (admin-scoped endpoint)

`NetworkScreen.tsx`
- `API.searchUsers('')` -> `GET /api/network/all` (or `/api/network/search` when query)
- `API.connectWithUser(userId)` -> `POST /api/network/:userId/connect`
- `API.disconnectFromUser(userId)` -> `POST /api/network/:userId/disconnect`
- `API.getOrCreateConversation(userId)` -> `POST /api/messages/conversations/create`

`OpportunitiesScreen.tsx`
- `API.getOpportunities()` -> `GET /api/opportunities/list`
- `API.createOpportunity()` -> `POST /api/opportunities/create`
- `API.applyToOpportunity(id)` -> `POST /api/opportunities/:id/apply`
- `API.bookmarkOpportunity()/removeOpportunityBookmark()` -> `POST /api/opportunities/:id/bookmark|unbookmark`

`HelpDeskScreen.tsx`
- `API.getHelpDeskPosts()` -> `GET /api/helpdesk/posts`
- `API.createHelpDeskPost()` -> `POST /api/helpdesk/posts`

`ProfileScreen.tsx`
- `API.getUserProfile()` -> `GET /api/users/profile`
- `API.getUserPosts()` -> `GET /api/users/posts`
- `apiClient.uploadProfilePicture()` -> `POST /api/upload/profile-picture`
- `API.updateUserProfile()` -> `PUT /api/users/profile`

`UserProfileScreen.tsx`
- `API.getNetworkUserProfile(userId)` -> `GET /api/network/user/:userId`
- `API.getFeedPosts()` (then filters client-side)
- `API.connectWithUser()/disconnectFromUser()`
- `API.getOrCreateConversation(userId)`

`LoginScreen.tsx`
- User login: `API.loginUser()` -> `POST /api/auth/login`
- Admin login: `API.loginAdmin()` -> `POST /api/auth/admin-login`
- On user login success, token is copied into `apiClient` and socket connect is triggered.

`RegisterScreen.tsx`
- `API.uploadIdProof()` -> `POST /api/auth/upload-id-proof`
- `API.registerUser()` -> `POST /api/auth/register`

`AdminScreen.tsx`
- `getAdminStats()` -> `GET /api/admin/stats`
- `getPendingUsers()` -> `GET /api/admin/pending-users`
- `getApprovedUsers()` -> `GET /api/admin/approved-users`
- `approveUser()/rejectUser()` -> `POST /api/admin/approve-user/:id`, `POST /api/admin/reject-user/:id`
- `getReportFilters()` -> `GET /api/admin/report-filters`
- `generateReport()` -> `POST /api/admin/generate-report`
- `getBroadcasts()/sendBroadcast()` -> `GET /api/admin/broadcasts`, `POST /api/admin/broadcast`

## 5. Backend API Design
All mounted from `backend/server.js`:
- `/api/metrics`
- `/api/auth`
- `/api/admin`
- `/api/users`
- `/api/feed`
- `/api/opportunities`
- `/api/helpdesk`
- `/api/network`
- `/api/messages`
- `/api/notifications`
- `/api/upload`

## 5.1 Auth (`backend/routes/auth.routes.js`)
- `POST /api/auth/upload-id-proof`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/admin-login`
- `POST /api/auth/refresh-token`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Behavior highlights:
- Registration creates user with `pending_approval` status.
- Password hash stored in `user_auth`; login disabled until admin approval.
- Login checks approved status and `is_login_enabled`.
- Refresh token persisted/revoked in DB.

## 5.2 Admin (`backend/routes/admin.routes.js`)
- Pending/approved lists, approve/reject actions.
- User details + verification logs.
- Dashboard stats.
- Report filters and Excel generation.
- Broadcast endpoints (`/broadcast`, `/broadcasts`) exist in this route file.

## 5.3 Users (`backend/routes/user.routes.js`)
- `GET /api/users/profile`
- `PUT /api/users/profile`
- `GET /api/users/status`
- `POST /api/users/upload-profile-picture`
- `GET /api/users/posts`

## 5.4 Feed (`backend/routes/feed.routes.js`)
- Posts list/create/update/delete.
- Like/unlike/save/unsave/share.
- Comments CRUD subset.
- User posts (`/user/:userId`).
- Trending posts (`/trending`).

Key internals:
- Cursor pagination by timestamp.
- Feed ordering includes recency + engagement score.
- Redis cache keys like `feed:*`.
- Socket broadcasts to room `feed` for new/updated/deleted/liked/commented/shared events.
- Queue jobs for notifications and engagement recompute.

## 5.5 Messaging (`backend/routes/messages.routes.js`)
- `GET /api/messages/conversations`
- `GET /api/messages/with/:userId`
- `POST /api/messages/send`
- `GET /api/messages/unread/count`
- `PUT /api/messages/:messageId/read`
- `DELETE /api/messages/:messageId`
- `POST /api/messages/conversations/create`
- `GET /api/messages/connected-users`
- `GET /api/messages/search-users`

Key internals:
- Fetching a conversation marks incoming messages read and emits read receipts.
- Sending message may transition to delivered if receiver is online.
- Typing and delivery/read events are socket-driven.

## 5.6 Notifications (`backend/routes/notifications.routes.js`)
- List notifications with cursor and unread count.
- Get unread count.
- Mark one or all as read.
- Delete notification.

## 5.7 Network (`backend/routes/network.routes.js`)
- Discover/search approved users.
- Fetch user profile for network card.
- Fetch user connections.
- Connect/disconnect endpoints (both path-param and body variants are present).
- Network stats endpoint.

## 5.8 Opportunities (`backend/routes/opportunities.routes.js`)
- Create/list/detail/apply/bookmark/unbookmark/bookmark-list.
- Applying can auto-send a message to opportunity poster.

## 5.9 Helpdesk (`backend/routes/helpdesk.routes.js`)
- List posts.
- Fetch single post + responses.
- Create post.
- Add response.
- Mark response as solution.
- Close post.

## 5.10 Upload (`backend/routes/upload.routes.js`)
- `POST /api/upload/profile-picture`
- `POST /api/upload/post-image`
- `POST /api/upload/message-image`
- `DELETE /api/upload/image`

## 6. Real-Time (Socket.IO)
Server: `backend/config/socket.js`.
Client: `alumini-connect/services/socket.service.ts`.

Authentication:
- Socket auth token from handshake (`auth.token` or Authorization header).
- Verified with JWT access secret.

Presence model:
- On connect: joins `user:{userId}` room and writes `user:online:{userId}` in Redis.
- On disconnect: clears online key, writes last seen key.

Client-emitted events:
- `join:room`
- `leave:room`
- `typing:start`
- `typing:stop`

Server-emitted events:
- Presence: `user:online`, `user:offline`
- Feed: `post:new`, `post:updated`, `post:deleted`, `post:liked`, `post:unliked`, `post:commented`, `comment:deleted`, `post:shared`
- Messaging: `message:new`, `message:delivered`, `message:read`, `messages:read`, `message:deleted`
- Typing: `typing:start`, `typing:stop`
- Notification: `notification:new`

Client service also re-emits alias event names for legacy code (`new_message`, `new_like`, etc.).

## 7. Database Model (Core)
Base creation is in `backend/database/init.js`; augmentations in `backend/database/migrate.js`.

Core tables:
- Users/auth: `users`, `user_auth`, `admin_users`, `refresh_tokens`, `admin_refresh_tokens`, `verification_logs`
- Feed: `feed_posts`, `post_likes`, `post_comments`, `saved_posts`, `post_mentions`, `post_shares`
- Messaging: `messages`, `conversations`, `conversation_participants`
- Notifications: `notifications`
- Network: `user_connections`, `search_history`
- Opportunities/helpdesk: `opportunities`, `opportunity_applications`, `bookmarks`, `help_desk_posts`, `help_desk_responses`
- Broadcasts: `broadcasts`

Notable migrations:
- Adds performance indexes across high-traffic columns.
- Adds soft-delete columns (`deleted_at`) for several tables.
- Adds engagement/trending fields for feed ranking.
- Adds message status/delivered timestamps and image support.

## 8. Caching, Queues, and Monitoring
Caching (`backend/config/redis.js` + route usage):
- Feed, conversations, connected users, unread counts.
- Degraded mode supported if Redis is unavailable.

Queues (`backend/services/queue.service.js`):
- Notification jobs: like/comment/message/connection/new post/new opportunity.
- Feed jobs: engagement and trending updates.

Monitoring (`backend/middleware/metrics.js`, `backend/routes/metrics.routes.js`):
- Tracks response times and status.
- Exposes `/api/metrics` (admin) and `/api/metrics/health` (public).

## 9. Upload and Image Delivery Path
Upload path:
1. Frontend sends multipart image to `/api/upload/*`.
2. Multer writes temp file in `uploads/temp`.
3. `MediaService` uploads to Cloudinary if configured, else saves locally.
4. Response returns `url` and optional `thumbnailUrl`.

Serving path:
- `backend/server.js` defines custom `/uploads/*` handler before generic CORS middleware.
- Explicit CORS and `Cross-Origin-Resource-Policy: cross-origin` headers are set to prevent browser cross-origin image blocking.

## 10. Security and Validation
- Access/admin/refresh token middleware in `backend/middleware/auth.js`.
- Request body validation schemas in `backend/middleware/validation.js`.
- Input script-tag sanitization middleware (`sanitizeInput`).
- Rate limiting in `backend/middleware/rateLimiter.js` on auth/upload/posts/messages plus global API limiter.

## 11. Environment and Startup
Frontend (`alumini-connect/package.json`):
- `npm start` -> `expo start --lan`
- `npm run android`, `npm run ios`, `npm run web`
- API base from `EXPO_PUBLIC_API_URL`, defaults to `http://localhost:5000`

Backend (`backend/package.json`):
- `npm start` -> `node server.js`
- `npm run dev` -> `nodemon server.js`
- `npm run setup:db` -> schema init
- `npm run migrate` -> migrations

Common backend env vars:
- DB: `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SSL`
- JWT: `JWT_SECRET`, `JWT_REFRESH_SECRET`
- Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- Upload/media: `UPLOAD_DIR`, `MAX_FILE_SIZE`, `CLOUDINARY_*`, `BACKEND_URL`
- App: `PORT`, `NODE_ENV`, `CLIENT_URL`

## 12. Known Integration Characteristics and Mismatches
- Two frontend API clients are active simultaneously (`api.ts` and `services/api.client.ts`).
- Response parsing in `MessagingScreen.tsx` supports multiple payload shapes because API wrappers and route outputs differ.
- Unread message count field naming differs by layer (`unread_count` in backend messages route vs screen expecting `count` in app shell through `apiClient.getUnreadCount()` logic).
- `api.ts` is used by multiple screens and includes admin-related and user-related calls in one module.
- `api.ts` currently starts with exported functions before import lines, indicating likely file-order corruption but still included in runtime bundle depending on tooling behavior.

## 13. End-to-End Request Examples
## 13.1 New Feed Post with Image
1. `FeedScreen` picks image and calls `apiClient.uploadPostImage`.
2. Backend `/api/upload/post-image` returns image URL.
3. `FeedScreen` sends `/api/feed/posts` with `content` + `image_url`.
4. Backend inserts row, invalidates `feed:*` cache, emits `post:new`, queues notifications for connections.

## 13.2 Messaging + Read Receipts
1. User sends message via `/api/messages/send`.
2. Backend inserts row, emits `message:new` to receiver.
3. If receiver online, backend updates to `delivered`, emits `message:delivered`.
4. Receiver opens chat (`GET /api/messages/with/:id`), server marks unread rows read and emits `messages:read`.

## 13.3 Opportunity Apply Auto-Message
1. Applicant calls `POST /api/opportunities/:id/apply`.
2. Backend inserts application.
3. Backend auto-creates a message to opportunity poster.
4. Poster receives real-time `message:new` and unread update event.

## 14. Operational Checklist for This Codebase
- Ensure PostgreSQL is reachable before backend start.
- Ensure Redis is reachable for full feature performance, but backend can run degraded if not.
- Run migrations after schema changes.
- Ensure `EXPO_PUBLIC_API_URL` points to reachable backend from device/emulator/web browser.
- If image load CORS issues appear, verify custom `/uploads/*` headers in `backend/server.js`.

## 15. Key Files to Read First
- Frontend entry: `alumini-connect/App.tsx`
- Frontend API clients: `alumini-connect/services/api.client.ts`, `alumini-connect/api.ts`
- Frontend realtime: `alumini-connect/services/socket.service.ts`, `alumini-connect/hooks/useSocket.ts`
- Backend bootstrap: `backend/server.js`
- Backend auth middleware: `backend/middleware/auth.js`
- Backend core feature routes: `backend/routes/*.routes.js`
- DB setup/migrations: `backend/database/init.js`, `backend/database/migrate.js`
- Queue + notifications: `backend/services/queue.service.js`, `backend/services/notification.service.js`

## 16. Summary
This project is already a fairly complete social networking backend + client stack with real-time messaging and admin moderation. The most important architectural reality is the dual frontend API-client layer and the heavy backend feature surface (feed, messaging, network, opportunities, helpdesk, admin), all built on Express routes plus Socket.IO and PostgreSQL.

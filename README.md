# Shareamigo

Share anything · Instantly · Anywhere

Shareamigo is a real-time file and data sharing application that allows users to quickly share files, text, and media with others using simple unique codes. No accounts required, no file size limits, and no complexity.

## 🚀 Features

### 📤 Simple Send
- Generate a unique 8-character code instantly
- Share text, files, or clipboard content
- One-time share link (latest content only)
- Share anything up to 100MB

### 📥 Easy Receive  
- Enter a code to receive shared content
- Automatic download or preview
- Zero authentication needed
- Works on any device

### 💬 Chat Rooms
- Create or join persistent chat rooms with unique codes
- Real-time messaging between multiple users
- Share files directly in rooms
- Full message and file history for new joiners
- Only room creator can clear history

### 🔐 Authentication
- Login with Email/Password
- Google Sign-in integration (Firebase)
- Continue as Guest (no signup required)
- Automatic session persistence
- Optional user identification

### 🎨 Theme Support
- Light, Dark, and System Auto themes
- Persistent theme preference
- Smooth theme transitions

### 📋 Clipboard Sync
- Automatic clipboard detection
- Quick send or share to room
- Text preview before sending

## 🛠️ Tech Stack

**Backend:**
- [Node.js](https://nodejs.org/) with Express.js 5.2
- [Socket.IO](https://socket.io/) 4.8 - Real-time bidirectional communication
- [UUID](https://www.npmjs.com/package/uuid) 13.0 - Unique identifier generation

**Frontend:**
- Vanilla JavaScript (no frameworks)
- HTML5 & CSS3 with custom themes
- Socket.IO client library

**Authentication:**
- Firebase Authentication
- Email/Password and Google OAuth support

## 📦 Installation

### Prerequisites
- Node.js 14+ and npm

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd shreamigo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase** (optional for authentication features)
   - Update Firebase credentials in `public/js/firebase.js`
   - Get your Firebase config from [Firebase Console](https://console.firebase.google.com/)

4. **Start the server**
   ```bash
   node server.js
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📖 Usage Guide

### Send Content

1. Click **📤 Send** from the landing screen
2. Click "Generate Code" to get a unique 8-character code
3. Share the code with someone else
4. Choose what to send:
   - **Text**: Type or paste text
   - **File**: Drag & drop or click to upload (up to 100MB)
5. Click "Send" — receiver can now get it with the code

### Receive Content

1. Click **📥 Receive** from the landing screen
2. Enter the 8-character code provided by sender
3. Content downloads automatically
4. For text, preview is shown before saving

### Chat Rooms

1. Click **💬 Rooms** from the landing screen

**To Create a Room:**
- Click "Generate Code"
- Click "Create Room"
- Share the code with others

**To Join a Room:**
- Enter someone's room code
- Click "Join Room"
- Start messaging in real-time

**In a Room:**
- Send text messages instantly
- Share files (they are saved in room history)
- New members see full message & file history
- Only creator can leave permanently

### Clipboard Sync

- Click **📋 Sync Clipboard** to detect copied content
- Choose to send as Simple Send or to a Room
- Redirects to appropriate screen after confirmation

## 📁 Project Structure

```
shreamigo/
├── server.js              # Express + Socket.IO server
├── package.json           # Dependencies & metadata
├── README.md              # This file  
└── public/
    ├── index.html         # Main app interface
    ├── login.html         # Authentication page
    ├── css/
    │   ├── theme.css      # Light/Dark/Auto theme system
    │   ├── layout.css     # Grid & container layout
    │   ├── components.css # Buttons, cards, popups
    │   ├── chat.css       # Chat room styling
    │   └── auth.css       # Login page styling
    └── js/
        ├── app.js         # Main app initialization & navigation
        ├── auth.js        # Firebase auth & login flow
        ├── send.js        # Send feature logic
        ├── receive.js     # Receive & file download logic
        ├── room.js        # Chat room create/join/messaging
        ├── socket.js      # Socket.IO event handlers
        ├── firebase.js    # Firebase configuration
        ├── clipboard.js   # Clipboard detection & sync
        ├── sync.js        # Real-time sync utilities
        └── theam.js       # Theme switching logic
```

## 🔄 How It Works

### Architecture

```
Client (Browser)
    ↓
Socket.IO WebSocket Connection
    ↓
Server (Express + Socket.IO)
    ↓
In-Memory Storage (latestShare, rooms)
```

### Simple Send Flow
1. Client requests send code from server
2. Server generates unique 8-char code, stores it
3. Client sends content with code
4. Server stores content keyed by code
5. Another client retrieves content using code

### Room Flow
1. Client requests room code from server
2. Server generates unique code, initializes room
3. Creator joins room (added to members set)
4. Other clients join using code
5. All messages/files broadcast to room members
6. New joiners receive full history

### Code Generation
- Uses 62 characters (A-Z, a-z, 0-9)
- 8-character length = 62^8 ≈ 218 trillion combinations
- Every generated code tracked globally to prevent duplicates
- Collision chance negligible even with billions of users

## 🔒 Security Considerations

- **Simple Send**: Not encrypted in transit. Use HTTPS in production for protection.
- **Room Codes**: 8-char codes provide uniqueness but not encryption. Consider as share URLs.
- **Firebase Auth**: Credentials should be kept secure and rotated regularly.
- **No User Data Storage**: Shares and rooms are session-only in memory.
- **File Limits**: 100MB max per Socket.IO buffer (configurable in server).

## ⚙️ Server Configuration

Edit `server.js` to customize:

```javascript
// Buffer size for file transfers (default: 100MB)
maxHttpBufferSize: 100 * 1024 * 1024

// Code length (default: 8 characters)
const CODE_LENGTH = 8;

// Character set for codes
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
```

## 🚀 Deployment

### Production Checklist
- [ ] Enable HTTPS/TLS for all connections
- [ ] Set Firebase credentials in `.env` file
- [ ] Use process manager (PM2, systemd) for server restart
- [ ] Configure CORS if needed: `socket.io({ cors: { origin: "https://yourdomain.com" } })`
- [ ] Monitor memory usage (rooms/shares stored in RAM)
- [ ] Implement cleanup: Remove old rooms/shares periodically
- [ ] Add rate limiting to protect against abuse
- [ ] Set Socket.IO reconnection limits

### Heroku / Cloud Deployment
```bash
npm install -g heroku-cli
heroku create shreamigo
git push heroku main
heroku open
```

## 🐛 Known Limitations / Future Improvements

- In-memory storage: Data lost on server restart (consider database)
- No persistent history: Rooms cleared when creator disconnects
- No end-to-end encryption: Should add for sensitive data
- No spam/rate limiting: Could add to prevent abuse
- Single server only: Horizontal scaling needs clustering

## 📝 License

ISC

## 👤 Author

Created with ❤️

---

**Questions or Issues?** Found a bug? Feel free to open an issue or contribute improvements!
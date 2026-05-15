# Firebase Setup Guide for Irreallab Admin Panel

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"**
3. Enter project name: `irreallab-admin` (or any name)
4. Accept terms, click **"Create project"**
5. Wait for project creation (1-2 minutes)

---

## Step 2: Enable Firestore Database

1. In Firebase Console, go to **Build → Firestore Database**
2. Click **"Create Database"**
3. Choose region: **Europe (Belgium)** (or closest to you)
4. Select **"Start in production mode"**
5. Click **"Create"**

---

## Step 3: Enable Authentication

1. Go to **Build → Authentication**
2. Click **"Get Started"**
3. Under "Sign-in method", click **"Email/Password"**
4. Enable the toggle, click **"Save"**
5. You can optionally enable "Email link sign-in" (not needed for this)

---

## Step 4: Create Firestore Collection

1. In **Firestore Database**, click **"Start collection"**
2. Collection ID: `reels` (exactly)
3. Click **"Next"**
4. For Document ID, choose **"Auto ID"**
5. Add these fields:
   - `title` (string): `"Closing Hours"`
   - `subtitle` (string): `"@irreallab · Watch on Instagram"`
   - `url` (string): `"https://www.instagram.com/reel/DYFrAFrIulH/"`
   - `hashtags` (string): `"#closinghours #museumafterdark #surrealwater #nightarchive #visualpoetry #irreallab"`
   - `status` (string): `"Live"`
   - `video_url` (string): `"https://scontent-cdg2-1.cdninstagram.com/..."`  *(optional, leave empty)*
   - `thumbnail_url` (string): `""` *(optional, leave empty)*
   - `order` (number): `1`
   - `createdAt` (timestamp): Set to current date

6. Click **"Save"**

**Repeat for other 3 reels** (or just create one for testing):
- Frame Shift, Art Heist, Drifting through
- Update `order` to 2, 3, 4 respectively

---

## Step 5: Get Your Firebase Config

1. In Firebase Console, click the **Settings icon** (⚙️) → **Project Settings**
2. Scroll to **"Your apps"**
3. Click **"Web"** (or create a web app)
4. Copy the entire `firebaseConfig` object

It looks like:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "irreallab-admin.firebaseapp.com",
  projectId: "irreallab-admin",
  storageBucket: "irreallab-admin.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def"
};
```

---

## Step 6: Create Admin User

1. Go to **Build → Authentication → Users**
2. Click **"Add User"**
3. Email: `admin@irreallab.fr` (or any email)
4. Password: Choose a **strong password** (you'll share with user2)
5. Click **"Add User"**

---

## Step 7: Set Firestore Security Rules

⚠️ **Important:** By default, production mode denies all reads/writes. We need to allow authenticated users.

1. Go to **Firestore Database → Rules**
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can read/write
    match /reels/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **"Publish"**

---

## Step 8: Copy Config to Project

1. Create a new file: `/firebase-config.js` in your project root
2. Paste your Firebase config:

```javascript
// firebase-config.js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export { firebaseConfig };
```

3. **Add to .gitignore:**
   ```
   firebase-config.js
   ```

---

## Step 9: Verify Setup

✅ Firestore collection `reels` exists with at least 1 document
✅ Authentication enabled with admin user created
✅ Security rules set to allow authenticated access
✅ `firebase-config.js` created with your config
✅ `firebase-config.js` added to `.gitignore`

**You're ready to proceed with implementation!**

---

## Troubleshooting

**"Permission denied" error when loading reels:**
- Check Firestore security rules are published
- Verify user is logged in to admin panel

**"Firebase not defined" error:**
- Ensure Firebase SDK script tag is in HTML
- Verify `firebase-config.js` is imported correctly

**Can't find Project Settings:**
- Click the ⚙️ icon at top-left, next to project name
- If no web app is created, click "Add app" first

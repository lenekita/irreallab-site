# Firebase Admin Panel — Implementation Guide

## Overview

You now have a complete Firebase-powered admin panel for managing reels. Here's what was created:

### New Files
- **`/admin.html`** — Admin interface (login + CRUD panel)
- **`/admin.css`** — Admin styling (dark theme, matches site)
- **`/firebase-config.js`** — Firebase credentials (⚠️ **YOU must fill this in**)
- **`/firestore-service.js`** — Database operations helper
- **`FIREBASE_SETUP.md`** — Step-by-step Firebase project setup
- **`.gitignore`** — Protects firebase-config.js

### Modified Files
- **`/reels.html`** — Updated to load from Firebase (with fallback to static JSON)

---

## Quick Start (3 Steps)

### Step 1: Set Up Firebase Project
Follow `FIREBASE_SETUP.md` line-by-line:
1. Create Firebase project
2. Enable Firestore + Authentication
3. Create `reels` collection with sample data
4. Create admin user
5. Get Firebase config

**Time: ~5 minutes**

### Step 2: Add Firebase Config
1. Open `/firebase-config.js`
2. Replace `YOUR_API_KEY_HERE` etc. with values from Firebase Console
3. Save

### Step 3: Test It
1. Open `/admin.html` in your browser
2. Login with email/password you created
3. Try adding/editing a reel
4. Open `/reels.html` — it should show your Firebase data

---

## How It Works

### User Flow

**Admin (user2):**
```
1. Go to /admin.html
2. Login with email + password
3. See list of all reels on left
4. Click reel → edit form appears on right
5. Edit title, subtitle, URL, hashtags, status
6. Live preview shows how it will look
7. Click "Save Reel" → updates Firebase immediately
8. Logout when done
```

**Public:**
```
1. Go to /reels.html
2. Automatically loads latest reels from Firebase
3. Everything appears exactly as admin configured
```

### Data Flow

```
Admin Panel (/admin.html)
    ↓
    [Firebase Authentication]
    ↓
    Firebase Firestore (reels collection)
    ↓
    /reels.html (loads real-time data)
    ↓
    Public sees live updates
```

---

## Key Features

### ✅ What User2 Can Do
- **Add reels** — Fill form, saves to Firebase instantly
- **Edit reels** — Click any reel, modify fields, save changes
- **Delete reels** — Confirm dialog prevents accidents
- **Reorder reels** — Reels appear in `order` field sequence (can edit manually in Firebase if needed)
- **Preview** — See exactly how reel will look on public page
- **Login/Logout** — Secure access with password

### ❌ What User2 Cannot Do
- Change styles/CSS — `admin.css` is locked
- See backend code — Only sees user-friendly form
- Access other data — Only manages `reels` collection

---

## Admin Panel Layout

```
┌─────────────────────────────────────────────────────────────┐
│  irreallab / Reels Admin                        [Logout]    │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                      │
│  + Add New Reel      │   EDIT FORM                          │
│  ┌────────────────┐  │  ┌──────────────────────────────────┐│
│  │ 01             │  │  │ Title *                          ││
│  │ Closing Hours  │  │  │ [_______________]                ││
│  │ Live           │  │  │                                  ││
│  └────────────────┘  │  │ Subtitle                         ││
│  ┌────────────────┐  │  │ [_______________]                ││
│  │ 02             │  │  │                                  ││
│  │ Frame Shift    │  │  │ Instagram URL *                  ││
│  │ Live           │  │  │ [https://...]                    ││
│  └────────────────┘  │  │                                  ││
│  ┌────────────────┐  │  │ Hashtags                         ││
│  │ 03             │  │  │ [#tags...]                       ││
│  │ Art Heist      │  │  │                                  ││
│  │ Live           │  │  │ [Save] [Delete] [Cancel]         ││
│  └────────────────┘  │  └──────────────────────────────────┘│
│                      │                                      │
│  [Scrollable]        │   PREVIEW                            │
│                      │  ┌──────────────────────────────────┐│
│                      │  │ 01                     Live      ││
│                      │  │ ┌────────────────────────────────┤│
│                      │  │ │ [Instagram Embed Preview]      ││
│                      │  │ │                                ││
│                      │  │ └────────────────────────────────┤│
│                      │  │ Closing Hours                    ││
│                      │  │ @irreallab · Watch on Instagram  ││
│                      │  │ #closinghours #museumafterdark   ││
│                      │  └──────────────────────────────────┘│
└──────────────────────┴──────────────────────────────────────┘
```

---

## Troubleshooting

### "Firebase is not defined"
- **Problem:** firebase-config.js wasn't filled in
- **Fix:** Replace API keys in firebase-config.js with your Firebase credentials

### "Permission denied" when saving
- **Problem:** Firestore security rules not set correctly
- **Fix:** Go to Firebase Console → Firestore Rules, ensure authenticated access is allowed

### Admin page shows blank / login doesn't work
- **Problem:** Firebase SDK not loading
- **Fix:** Check browser console (F12) for errors, ensure firebase-config.js is in project root

### Reels don't appear on /reels.html
- **Problem:** Firebase query failed
- **Fix:** 
  1. Check Firebase collection name is exactly `reels`
  2. Ensure at least one reel exists in Firestore
  3. Check browser console for error messages
  4. reels.html will fall back to static reels.json if Firebase fails

### Can't login
- **Problem:** Wrong email/password
- **Fix:** Go to Firebase Console → Authentication → Users, verify admin account exists

---

## Next Steps

1. **Follow FIREBASE_SETUP.md** to create your Firebase project
2. **Fill in firebase-config.js** with your credentials
3. **Test admin panel** at `/admin.html`
4. **Test public page** at `/reels.html`
5. **Share `/admin.html` link with user2** along with email/password

---

## Important Notes

### Security
- ⚠️ **Never commit firebase-config.js to GitHub** — it's in .gitignore
- ✅ Add to .gitignore before pushing
- ✅ Change Firebase security rules to production-mode when live

### Backups
- Keep `reels.json` as backup (still works as fallback)
- Firebase Firestore has automatic backups

### Updates
- If you add more fields to reels, just add them to the form in admin.html
- Firestore schema is flexible — new fields auto-create

---

## Support

If something doesn't work:
1. Check browser console (F12) for errors
2. Verify Firebase config values are correct
3. Ensure Firestore security rules are set
4. Check authentication is enabled in Firebase Console

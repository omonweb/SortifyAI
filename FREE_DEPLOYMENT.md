# SortifyAI - Free Deployment Guide

## Completely Free Setup

This guide shows you how to deploy all services for **absolutely free** or with minimal cost ($3-5/month optional for backend).

---

## What's Free?

| Service | Free Tier | Cost |
|---------|-----------|------|
| **Firebase** | Spark plan (generous) | ✅ Free |
| **Vercel** (Frontend) | 100GB/month bandwidth | ✅ Free |
| **Render** (Backend) | Free web service (spins down) | ✅ Free |
| **Render** (ML Service) | Free web service (spins down) | ✅ Free |
| **Total** | Full stack deployment | **$0/month** |

**Trade-off**: Free services on Render spin down after 15 mins of inactivity (5-30 sec startup on next request).

---

## Option 1: Vercel + Render (Completely Free)

### Phase 1: Firebase Setup (Free Spark Plan)

1. Go to [firebase.google.com](https://console.firebase.google.com)
2. Click **Create Project** → `sortifyai-2026`
3. **Don't** choose "Blaze" plan, stick with **Spark** (free)
4. Create and enable:
   - ✅ **Firestore Database** (free: 50K reads/20K writes per day)
   - ✅ **Cloud Storage** (free: 5GB, 1GB/day downloads)
   - ✅ **Authentication** (free: 100K users)

5. **Get Backend Credentials**:
   - Project Settings → Service Accounts → Generate new private key
   - Save as `backend/firebase-service-account.json`

6. **Get Frontend Credentials**:
   - Project Settings → General → Copy Web App Config
   - You'll see: `apiKey`, `projectId`, `storageBucket`, etc.

---

### Phase 2: Deploy Frontend on Vercel (Free)

1. **Create GitHub account** (if you don't have one):
   - Go to [github.com](https://github.com)
   - Sign up (free)

2. **Upload your code to GitHub**:
   ```bash
   cd sortifyai
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/sortifyai.git
   git push -u origin main
   ```

3. **Deploy on Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub
   - Click **Add New...** → **Project**
   - Import `sortifyai` repository
   - Select folder: `frontend`
   - Add environment variables:
     ```
     NEXT_PUBLIC_API_URL=https://sortifyai-backend.onrender.com
     NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
     NEXT_PUBLIC_FIREBASE_PROJECT_ID=sortifyai-2026
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sortifyai-2026.firebasestorage.app
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sortifyai-2026.firebaseapp.com
     ```
   - Click **Deploy**
   - Get your URL: `https://sortifyai.vercel.app`

---

### Phase 3: Deploy Backend on Render (Free)

1. **Create Render account**:
   - Go to [render.com](https://render.com)
   - Sign up with GitHub
   - Grant access to your repository

2. **Deploy backend**:
   - Dashboard → **New+** → **Web Service**
   - Connect your `sortifyai` repository
   - Fill in:
     - **Name**: `sortifyai-backend`
     - **Root Directory**: `backend`
     - **Runtime**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: `Free`
   - Add environment variables:
     ```
     NODE_ENV=production
     FIREBASE_CREDENTIALS={"type":"service_account",...paste entire JSON...}
     FIREBASE_STORAGE_BUCKET=sortifyai-2026.firebasestorage.app
     ML_SERVICE_URL=https://sortifyai-ml.onrender.com
     CORS_ORIGIN=https://sortifyai.vercel.app
     ```
   - Click **Create Web Service**
   - Get your URL: `https://sortifyai-backend.onrender.com`

3. **Update Vercel frontend**:
   - Go back to Vercel dashboard
   - Settings → Environment Variables
   - Update `NEXT_PUBLIC_API_URL=https://sortifyai-backend.onrender.com`
   - Redeploy

---

### Phase 4: Deploy ML Service on Render (Free)

1. **Create Dockerfile in ml-service** (already created ✓)

2. **Deploy ML Service**:
   - Go to [render.com](https://render.com) dashboard
   - **New+** → **Web Service**
   - Connect your `sortifyai` repository
   - Fill in:
     - **Name**: `sortifyai-ml`
     - **Root Directory**: `ml-service`
     - **Runtime**: `Docker`
     - **Plan**: `Free`
   - Add environment variables:
     ```
     HOST=0.0.0.0
     PORT=8000
     WORKERS=4
     ```
   - Click **Create Web Service**
   - Get your URL: `https://sortifyai-ml.onrender.com`

3. **Update backend**:
   - Go to Render dashboard → `sortifyai-backend` settings
   - Environment Variables → Update `ML_SERVICE_URL=https://sortifyai-ml.onrender.com`
   - Redeploy

---

### Phase 5: Verify Everything Works

```bash
# Test Frontend
curl https://sortifyai.vercel.app

# Test Backend API
curl https://sortifyai-backend.onrender.com/health

# Test ML Service
curl https://sortifyai-ml.onrender.com/docs
```

**If API calls work**, your app is live! 🎉

---

## Phase 6: Email Service Setup (Optional but Recommended)

Your backend sends emails to candidates. Choose one free email service:

### Option A: Gmail SMTP (Free, Easiest)

**Best for**: Quick setup, personal emails

1. **Enable 2-Factor Authentication on Gmail**:
   - Go to [myaccount.google.com/security](https://myaccount.google.com/security)
   - Left menu → 2-Step Verification
   - Follow prompts to enable

2. **Create App Password**:
   - [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select: App = `Mail`, Device = `Windows Computer` (or your OS)
   - Google generates 16-character password
   - Copy this password (you'll need it)

3. **Update Backend Environment Variables**:
   - Go to Render dashboard → `sortifyai-backend` → Environment
   - Add or update:
     ```
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=your-email@gmail.com
     SMTP_PASS=your-16-character-app-password
     SMTP_FROM=SortifyAI <your-email@gmail.com>
     SMTP_SECURE=false
     ```
   - **Redeploy** the backend service

4. **Test Email**:
   - In your backend code, test the `sendCandidateEmail` function
   - Check spam folder if email doesn't arrive

**Limits**: 500 emails/day (enough for MVP)

---

### Option B: SendGrid (Free, Best for Production)

**Best for**: Production apps, better deliverability, 100 emails/day free

1. **Create SendGrid Account**:
   - Go to [sendgrid.com](https://sendgrid.com)
   - Sign up (free)
   - Verify email address

2. **Create API Key**:
   - Dashboard → Settings → API Keys
   - Create new API Key
   - Copy the key (save somewhere safe)

3. **Update Backend Environment Variables**:
   - Go to Render dashboard → `sortifyai-backend` → Environment
   - Add or update:
     ```
     SENDGRID_API_KEY=SG.your-api-key-here
     SENDGRID_FROM_EMAIL=noreply@yourdomain.com
     SENDGRID_FROM_NAME=SortifyAI
     ```
   - **Redeploy** the backend service

4. **Update Backend Code** (if using SendGrid):
   - In `backend/emailService.js`, change from nodemailer to SendGrid:
   ```javascript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);

   async function sendCandidateEmail(to, subject, htmlContent) {
     const msg = {
       to,
       from: process.env.SENDGRID_FROM_EMAIL,
       subject,
       html: htmlContent,
     };
     await sgMail.send(msg);
   }
   ```

**Limits**: 100 emails/day free (paid starts at $29/mo if needed)

---

### Option C: Mailgun (Free, Advanced)

**Best for**: High volume, webhooks, advanced features

1. **Create Mailgun Account**:
   - Go to [mailgun.com](https://www.mailgun.com)
   - Sign up (free sandbox account)

2. **Get Credentials**:
   - Dashboard → Domain Information
   - Copy: API Key, Domain

3. **Update Backend Environment Variables**:
   ```
   MAILGUN_API_KEY=your-api-key
   MAILGUN_DOMAIN=sandbox123.mailgun.org
   ```

4. **Update Code**: Use Mailgun SDK in `emailService.js`

**Limits**: 100 emails/month (sandbox), upgrade to custom domain for 10K/month free

---

### Comparison: Gmail vs SendGrid vs Mailgun

| Feature | Gmail | SendGrid | Mailgun |
|---------|-------|----------|---------|
| **Free Limit** | 500/day | 100/day | 100/month (sandbox) |
| **Setup Time** | 5 mins | 10 mins | 15 mins |
| **Code Changes** | None | Update code | Update code |
| **Deliverability** | Good | Excellent | Excellent |
| **Best For** | Quick MVP | Production | Advanced users |

**Recommendation**: Start with **Gmail** (easiest), upgrade to **SendGrid** if needed.

---

### Testing Email Sending

After setting up SMTP, test it:

1. **Via Backend API** (if you have an endpoint):
   ```bash
   curl -X POST https://sortifyai-backend.onrender.com/api/send-test-email \
     -H "Content-Type: application/json" \
     -d '{"email":"your-email@example.com","subject":"Test"}'
   ```

2. **Check Logs**:
   - Render dashboard → `sortifyai-backend` → Logs
   - Look for email service output
   - Check if errors appear

3. **Email Not Arriving?**:
   - Check spam/promotions folder
   - Verify email address in env variables
   - Check backend logs for errors
   - Try sending from Gmail interface first (to confirm SMTP works)

---

### Important: Email Security

**Never hardcode email passwords!**

✅ **Correct**: Use environment variables
```
SMTP_PASS=your-16-char-password  (in Render env vars)
```

❌ **Wrong**: Put in code
```javascript
const password = 'your-16-char-password'; // DON'T DO THIS!
```

---

## Option 2: Vercel + Fly.io (Free with Allowances)

### Advantages over Render:
- More generous free tier
- Doesn't spin down (stays active)
- 3 free shared-cpu-1x 256MB VMs

### Setup:

1. **Create Fly.io account**:
   - [fly.io](https://fly.io)
   - Sign up (free, no credit card initially)

2. **Deploy Backend**:
   ```bash
   cd backend
   flyctl launch
   # Select: Create new app, region closest to you
   # Yes to create Dockerfile
   ```

3. **Add secrets**:
   ```bash
   flyctl secrets set NODE_ENV=production
   flyctl secrets set FIREBASE_CREDENTIALS='{"type":"service_account",...}'
   flyctl secrets set FIREBASE_STORAGE_BUCKET=sortifyai-2026.firebasestorage.app
   flyctl secrets set ML_SERVICE_URL=https://sortifyai-ml.fly.dev
   flyctl secrets set CORS_ORIGIN=https://sortifyai.vercel.app
   ```

4. **Deploy**:
   ```bash
   flyctl deploy
   ```

5. **Similar steps for ML Service**:
   ```bash
   cd ../ml-service
   flyctl launch
   flyctl secrets set HOST=0.0.0.0
   flyctl deploy
   ```

---

## Option 3: All-In-One Free (Use Render + Free Postgres)

If you later need a database beyond Firebase:

- **Render**: Free Postgres database (0.5GB storage)
  - Connection string provided automatically
  - Set as environment variable

---

## ⚠️ Free Tier Limitations & Solutions

### Render Free Tier Issues:

| Issue | Cause | Solution |
|-------|-------|----------|
| **Slow startup (5-30 sec)** | Services spin down after 15 mins inactivity | Keep-alive ping: `curl service-url` every 10 mins |
| **Memory limited** | 512MB RAM shared | Optimize Node/Python code, lazy-load dependencies |
| **Cold starts** | Container restart | Expected behavior, users will experience brief delay |
| **Disk space** | Limited | Don't cache large files locally |

### Firebase Spark Limits:

| Resource | Limit | Solution |
|----------|-------|----------|
| **Daily reads** | 50K | Cache results, optimize queries |
| **Daily writes** | 20K | Batch operations, debounce updates |
| **Storage** | 5GB | Clean up old files, archive data |
| **Downloads** | 1GB/day | Compress files, use CDN |

**If you exceed these limits**, Firebase blocks requests until next day.

---

## Cost Comparison: Free vs. Premium

| Service | Free | Small Business | Notes |
|---------|------|---|-------|
| **Firebase** | Spark | Blaze (pay-as-you-go) | $0 vs. $0-100+ |
| **Vercel** | 100GB/mo | Pro ($20/mo) | Covers 99% of projects |
| **Render** | Spins down | Standard ($7/mo) | Paid = always-on |
| **Fly.io** | 3 x 256MB VMs | Custom pricing | More generous free tier |
| **Domain** | N/A | ~$10/year | Register separately |
| **TOTAL** | **$0** | **$10-40/month** | Free tier is sufficient for MVP |

---

## Monitoring Free Services

Since free services have limitations, monitor them:

1. **Add health check endpoint** (already in code):
   ```bash
   curl https://sortifyai-backend.onrender.com/health
   ```

2. **Keep services warm** (prevent spin-down):
   - Create a simple CloudFlare Worker (free) to ping services every 5 mins
   - Or use [Kaffeine](https://kaffeine.herokuapp.com) (free service pinger)

3. **Monitor Firebase usage**:
   - Firebase Console → Usage tab
   - Set up alerts at 80% of daily limits

4. **Check Render logs**:
   - Render dashboard → Service → Logs
   - View real-time issues

---

## Step-by-Step for Complete Beginner

### Step 1: Create GitHub Account (2 mins)
```
1. Go to github.com
2. Sign up → Create account
3. Create new repository named "sortifyai"
4. Upload your code to it
```

### Step 2: Set Up Firebase (5 mins)
```
1. Go to firebase.google.com
2. Create project "sortifyai-2026"
3. Enable Firestore + Cloud Storage
4. Download service account JSON
5. Copy web SDK credentials
```

### Step 3: Deploy Frontend (5 mins)
```
1. Go to vercel.com
2. Sign up with GitHub
3. Import sortifyai repo
4. Select /frontend folder
5. Add 5 environment variables
6. Deploy → Get URL
```

### Step 4: Deploy Backend (5 mins)
```
1. Go to render.com
2. Sign up with GitHub
3. Create web service from /backend
4. Add environment variables
5. Deploy → Get URL
```

### Step 5: Deploy ML Service (5 mins)
```
1. Render dashboard
2. Create web service from /ml-service
3. Select Docker runtime
4. Deploy → Get URL
```

### Step 6: Connect Everything (2 mins)
```
1. Update Vercel with backend URL
2. Update Render backend with ML URL
3. Test: curl your-vercel-url.com
```

**Total Time: ~30 minutes** ⏱️

---

## Troubleshooting Free Deployment

### "Vercel deployment failed"
```
Check build logs in Vercel dashboard:
Settings → Build & Development Settings → Build Command
Make sure: npm run build works locally first
```

### "Render service won't start"
```
1. Check Render logs: Dashboard → Service → Logs
2. Make sure dockerfile exists in root of service
3. Verify build command runs: npm install
4. Verify start command: npm start
```

### "Firebase says I exceeded quota"
```
Option 1: Wait until next day (quota resets)
Option 2: Switch to Blaze pay-as-you-go
Option 3: Optimize queries to use fewer reads/writes
```

### "API calls return 503 Service Unavailable"
```
Likely cause: Free service is spinning up
Solution: Wait 5-30 seconds, retry
To fix: Use Fly.io instead (never spins down)
```

### "Files not uploading to Cloud Storage"
```
1. Check CORS rules in Firebase Console
2. Verify bucket name in env variables
3. Check service account has Storage permissions
```

---

## Custom Domain (Optional, Costs $10-15/year)

If you want `myapp.com` instead of `*.vercel.app`:

1. **Buy domain**:
   - Namecheap, GoDaddy, or Route53 (~$10/year)

2. **Update Vercel**:
   - Project Settings → Domains → Add Domain
   - Follow DNS setup instructions
   - Update CORS_ORIGIN in backend

3. **Point Render to domain** (optional):
   - Advanced → Custom Domain
   - Update DNS CNAME

---

## Data Backup (Important!)

Since you're using Firebase:

1. **Enable Cloud Storage backups**:
   - Firebase Console → Cloud Storage
   - You get daily automated backups

2. **Export Firestore regularly**:
   ```bash
   gsutil -m cp -r gs://sortifyai-2026.appspot.com/firestore-export .
   ```

3. **Download important files**:
   - Not automated on free tier
   - Manually export if needed

---

## Scaling When Needed

If free tier isn't enough (exceeding quotas):

### Plan A: Stay Free, Optimize
- Cache results in browser
- Batch database writes
- Compress files
- Delete old data

### Plan B: Upgrade Selectively
| Service | Cost | Reason |
|---------|------|--------|
| Firebase → Blaze | $0-30/mo | Pay only for usage above quota |
| Render → Paid | $7/mo | Always-on, better performance |
| Vercel → Pro | $20/mo | Priority support |

---

## Estimated User Capacity

With **completely free setup**, you can handle:

- **100-500 active monthly users**
- **1000-5000 resume uploads/month**
- **Standard document processing**
- **Without hitting quotas**

For **1000+ users**, upgrade to paid tiers.

---

## Final Checklist

- [ ] Firebase Spark project created
- [ ] Service account JSON downloaded
- [ ] Web SDK credentials copied
- [ ] GitHub repo created with code
- [ ] Frontend deployed on Vercel
- [ ] Backend deployed on Render
- [ ] ML service deployed on Render
- [ ] Environment variables configured in all services
- [ ] Frontend URL updated in backend CORS
- [ ] Backend URL updated in frontend config
- [ ] ML service URL updated in backend config
- [ ] All services tested (curl health checks)
- [ ] Firebase Firestore rules configured
- [ ] Cloud Storage CORS configured
- [ ] Email service configured (Gmail/SendGrid/Mailgun)
- [ ] SMTP environment variables added to backend
- [ ] Email sending tested

---

## Support Links

- [Vercel Docs](https://vercel.com/docs)
- [Render Docs](https://render.com/docs)
- [Firebase Free Tier](https://firebase.google.com/pricing)
- [GitHub Docs](https://docs.github.com)
- [Fly.io Docs](https://fly.io/docs)
- [Gmail App Passwords](https://myaccount.google.com/apppasswords)
- [SendGrid Free Account](https://sendgrid.com/free)
- [Mailgun Free Tier](https://www.mailgun.com)

---

## Next Steps

1. **Start with Phase 1-2** (Firebase + Vercel Frontend) = 10 mins
2. **Add Phase 3** (Render Backend) = 5 mins
3. **Add Phase 4** (Render ML Service) = 5 mins
4. **Add Phase 6** (Email Service) = 5 mins
5. **Test everything** = 5 mins

**Your app is live in ~35 minutes for $0/month!** 🚀

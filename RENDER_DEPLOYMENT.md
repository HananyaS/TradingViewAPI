# Render Deployment Guide

This guide will help you deploy the TradingView Stock Screener application to Render.com.

## Prerequisites

1. **GitHub Account**: Your code should be in a GitHub repository
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **MongoDB Atlas Account**: For database (free tier available)
4. **Google Cloud Console**: For OAuth2 credentials

## Step 1: Prepare Your Code

### 1.1 Update Google OAuth Redirect URI

Before deploying, update your Google OAuth2 redirect URI:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Add authorized redirect URI: `https://your-app-name.onrender.com/oauth2callback`
5. Save changes

### 1.2 Environment Variables

You'll need to set these in Render's dashboard:

**Required:**
- `SECRET_KEY` - Flask secret key (generate a random string)
- `MONGODB_URL` - MongoDB Atlas connection string
- `MONGODB_DB` - Database name (default: `tradingview_screener`)
- `GOOGLE_CLIENT_ID` - Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret

**Optional:**
- `FLASK_ENV=production`
- `RENDER=true`
- `USE_FALLBACK_ONLY=false` (set to `true` if MongoDB connection fails)
- `USE_FILE_STORAGE=false` (set to `true` for file-based storage fallback)

## Step 2: Deploy on Render

### Option A: Using render.yaml (Recommended)

1. **Connect Repository**:
   - Go to Render Dashboard
   - Click **New** > **Blueprint**
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml`

2. **Review Configuration**:
   - Render will read the `render.yaml` file
   - Review the service configuration
   - Click **Apply**

3. **Set Environment Variables**:
   - Go to your service settings
   - Navigate to **Environment** tab
   - Add all required environment variables (see Step 1.2)
   - **Important**: Set `RENDER_EXTERNAL_URL` will be automatically set by Render

### Option B: Manual Setup

1. **Create Web Service**:
   - Go to Render Dashboard
   - Click **New** > **Web Service**
   - Connect your GitHub repository

2. **Configure Service**:
   - **Name**: `tradingview-screener` (or your preferred name)
   - **Environment**: `Python 3`
   - **Build Command**: `npm install && npm run build && pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Python Version**: `3.11.0` (or latest)

3. **Set Environment Variables**:
   - Go to **Environment** tab
   - Add all variables from Step 1.2
   - Click **Save Changes**

## Step 3: Build Configuration

### Build Command
```bash
npm install && npm run build && pip install -r requirements.txt
```

This will:
1. Install Node.js dependencies
2. Build the React app (outputs to `static/dist/`)
3. Install Python dependencies

### Start Command
```bash
gunicorn app:app
```

This starts the Flask app using Gunicorn (production WSGI server).

## Step 4: Verify Deployment

1. **Check Build Logs**:
   - Go to your service in Render
   - Click **Logs** tab
   - Verify build completed successfully
   - Look for: `✅ React app built successfully`

2. **Test the Application**:
   - Visit your Render URL: `https://your-app-name.onrender.com`
   - Test login with Google OAuth
   - Verify all features work

## Step 5: MongoDB Atlas Setup

1. **Create Cluster**:
   - Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a free M0 cluster

2. **Configure Network Access**:
   - Go to **Network Access**
   - Click **Add IP Address**
   - Click **Allow Access from Anywhere** (0.0.0.0/0)
   - This allows Render to connect

3. **Create Database User**:
   - Go to **Database Access**
   - Click **Add New Database User**
   - Create username and password
   - Set privileges to **Read and write to any database**

4. **Get Connection String**:
   - Go to **Database** > **Connect**
   - Choose **Connect your application**
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Add to Render environment variables as `MONGODB_URL`

## Troubleshooting

### Build Fails

**Issue**: Build command fails
- **Solution**: Check Node.js version (should be 18+)
- Check build logs for specific errors
- Ensure `package.json` is correct

### MongoDB Connection Fails

**Issue**: Cannot connect to MongoDB
- **Solution**: 
  - Verify `MONGODB_URL` is correct
  - Check MongoDB Atlas network access (allow 0.0.0.0/0)
  - Verify database user credentials
  - Set `USE_FALLBACK_ONLY=true` as temporary workaround

### OAuth Redirect Error

**Issue**: OAuth redirect fails
- **Solution**:
  - Verify redirect URI in Google Console matches Render URL
  - Format: `https://your-app-name.onrender.com/oauth2callback`
  - Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct

### React App Not Loading

**Issue**: Blank page or 404 errors
- **Solution**:
  - Verify `npm run build` completed successfully
  - Check that `static/dist/index.html` exists
  - Verify build output in logs
  - Check that React routes are properly configured

### Static Files Not Loading

**Issue**: CSS/JS files return 404
- **Solution**:
  - Verify `static/dist/` directory exists after build
  - Check Flask static folder configuration
  - Ensure build command runs before start command

## Environment Variables Reference

```env
# Flask
SECRET_KEY=your-random-secret-key-here
FLASK_ENV=production
RENDER=true

# MongoDB
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/tradingview_screener?retryWrites=true&w=majority
MONGODB_DB=tradingview_screener

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Optional
USE_FALLBACK_ONLY=false
USE_FILE_STORAGE=false
```

## Post-Deployment

1. **Update Google OAuth**:
   - Add production redirect URI
   - Test OAuth flow

2. **Monitor Logs**:
   - Check Render logs regularly
   - Monitor for errors

3. **Set Up Custom Domain** (Optional):
   - Go to service settings
   - Add custom domain
   - Update DNS records
   - Update Google OAuth redirect URI

## Cost Considerations

- **Render Free Tier**: 
  - Web services spin down after 15 minutes of inactivity
  - May take 30-60 seconds to wake up
  - Consider upgrading for production use

- **MongoDB Atlas Free Tier**:
  - 512MB storage
  - Shared cluster
  - Sufficient for development/small production

## Support

If you encounter issues:
1. Check Render logs
2. Check MongoDB Atlas logs
3. Verify all environment variables are set
4. Test locally with production settings


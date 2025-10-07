# Render Deployment Guide

## Prerequisites

1. **MongoDB Atlas Account**: Create a free cluster at https://www.mongodb.com/atlas
2. **Render Account**: Sign up at https://render.com

## Storage Options

### Option 1: MongoDB Atlas (Recommended for Production)
Follow the MongoDB Atlas setup below.

### Option 2: File Storage (Recommended for Render)
Use local file storage - more reliable on Render, data persists between deployments.

### Option 3: In-Memory Storage (Fallback)
Temporary storage - data lost on server restart.

## MongoDB Atlas Setup

### 1. Create MongoDB Atlas Cluster
1. Go to MongoDB Atlas and create a new cluster
2. Choose the free tier (M0)
3. Select your preferred cloud provider and region
4. Create the cluster

### 2. Configure Database Access
1. Go to "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Set a username and password (save these!)
5. Set privileges to "Read and write to any database"
6. Click "Add User"

### 3. Configure Network Access (IMPORTANT)
1. Go to "Network Access" in the left sidebar
2. Click "Add IP Address"
3. **Click "Allow Access from Anywhere" (0.0.0.0/0)**
4. Click "Confirm"

This is crucial for Render deployment - the app needs to connect from Render's servers.

### 4. Get Connection String
1. Go to "Database" in the left sidebar
2. Click "Connect"
3. Choose "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your actual password
6. Replace `<dbname>` with `tradingview_screener`

## Local Testing

Before deploying to Render, test your MongoDB connection locally:

```bash
# Set your MongoDB URL
export MONGODB_URL="mongodb+srv://username:password@cluster.mongodb.net/tradingview_screener"

# Test the connection
python test_mongodb.py
```

This will test the MongoDB Atlas connection with the simplified configuration.

## Render Deployment

### 1. Connect Your Repository
1. Go to Render Dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository

### 2. Configure Environment Variables

**Option 1: MongoDB Atlas (Now Simplified)**
```
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/tradingview_screener?retryWrites=true&w=majority
MONGODB_DB=tradingview_screener
```

**Option 2: File Storage (Recommended for Render)**
```
USE_FILE_STORAGE=true
```

**Option 3: In-Memory Storage (Fallback)**
```
USE_FALLBACK_ONLY=true
```

### 3. Configure Build Settings
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python app.py`

### 4. Deploy
1. Click "Create Web Service"
2. Wait for the build to complete
3. Your app will be available at the provided URL

## Troubleshooting

### Connection Issues
If you get connection errors:

1. **Verify Network Access**: Make sure MongoDB Atlas allows access from anywhere (0.0.0.0/0)
2. **Test locally first** using `python test_mongodb.py`
3. **Check credentials**: Verify username/password in connection string
4. **Use File Storage** as fallback:
   ```
   USE_FILE_STORAGE=true
   ```

### Common Issues

1. **Connection Timeout**: Network access not configured properly
2. **Authentication Failed**: Verify username/password in connection string
3. **SSL Errors**: Should be resolved with open network access
4. **Missing Dependencies**: Make sure all requirements are installed

### Environment Variables Format

**MongoDB Atlas:**
```
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/tradingview_screener?retryWrites=true&w=majority
MONGODB_DB=tradingview_screener
```

**File Storage (Recommended for Render):**
```
USE_FILE_STORAGE=true
```

**In-Memory Storage:**
```
USE_FALLBACK_ONLY=true
```

### Testing the Connection

The app will print connection status on startup:
- "✅ MongoDB Atlas connection successful!" = MongoDB working
- "Using file storage" = File storage working
- "Using fallback storage" = In-memory storage working

## Storage Comparison

| Feature | MongoDB Atlas | File Storage | In-Memory |
|---------|---------------|--------------|-----------|
| **Persistence** | ✅ Permanent | ✅ Permanent | ❌ Session only |
| **Reliability** | ✅ Good (with open network) | ✅ Very reliable | ✅ Always works |
| **Setup** | ⚠️ Requires Atlas setup | ✅ Simple | ✅ No setup |
| **Performance** | ✅ Fast | ✅ Fast | ✅ Fast |
| **Cost** | ⚠️ Free tier limits | ✅ Free | ✅ Free |

## Recommendation

**For production with MongoDB Atlas:**
```
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/tradingview_screener?retryWrites=true&w=majority
MONGODB_DB=tradingview_screener
```

**For Render deployment (if Atlas still has issues):**
```
USE_FILE_STORAGE=true
```

This provides:
- ✅ **Reliable persistence** - Data survives server restarts
- ✅ **No SSL issues** - Works perfectly on Render
- ✅ **Simple setup** - No external database needed
- ✅ **Fast performance** - Local file access
- ✅ **Free** - No additional costs 
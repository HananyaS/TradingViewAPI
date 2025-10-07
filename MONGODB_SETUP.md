# MongoDB Setup Guide

## Option 1: Local MongoDB (Recommended for Development)

1. **Install MongoDB Community Edition**:
   - Download from: https://www.mongodb.com/try/download/community
   - Or use Docker: `docker run -d -p 27017:27017 --name mongodb mongo:latest`

2. **Set Environment Variables**:
   ```bash
   export MONGODB_URL=mongodb://localhost:27017/
   export MONGODB_DB=tradingview_screener
   ```

## Option 2: MongoDB Atlas (Cloud)

1. **Create MongoDB Atlas Account**:
   - Go to: https://www.mongodb.com/atlas
   - Create a free cluster

2. **Get Connection String**:
   - In Atlas dashboard, click "Connect"
   - Choose "Connect your application"
   - Copy the connection string

3. **Set Environment Variables**:
   ```bash
   export MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/tradingview_screener
   export MONGODB_DB=tradingview_screener
   ```

## Option 3: No MongoDB (Fallback Mode)

If you don't set up MongoDB, the application will automatically use in-memory storage as a fallback. Data will be lost when the server restarts, but the application will still work.

## Troubleshooting

### Authentication Error
If you get "bad auth : authentication failed":
1. Check your MongoDB Atlas username and password
2. Make sure your IP is whitelisted in Atlas
3. Verify the connection string format

### Connection Error
If you get connection errors:
1. Check if MongoDB is running (for local setup)
2. Verify your connection string
3. Check network connectivity (for Atlas)

## Environment Variables

Create a `.env` file in the project root:

```env
# For local MongoDB
MONGODB_URL=mongodb://localhost:27017/
MONGODB_DB=tradingview_screener

# For MongoDB Atlas
# MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/tradingview_screener
# MONGODB_DB=tradingview_screener
```

## Testing the Connection

The application will automatically test the MongoDB connection on startup and fall back to in-memory storage if there are any issues. 
# Local Development Setup

## **Quick Start for Local Development**

### **1. Install Dependencies**
```bash
pip install -r requirements.txt
```

### **2. Set Up Google OAuth for Localhost**

#### **Step A: Google Cloud Console Setup**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client ID
3. Add these **Authorized JavaScript origins**:
   ```
   http://localhost:5000
   ```
4. Add these **Authorized redirect URIs**:
   ```
   http://localhost:5000/oauth2callback
   ```
5. Click "Save"

#### **Step B: Create Local Environment File**
```bash
python local_setup.py
```

This will create a `.env` file. Edit it with your Google OAuth credentials:

```env
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:5000/oauth2callback
SECRET_KEY=your-secret-key-here

# Optional: Use file storage instead of MongoDB
USE_FILE_STORAGE=true
```

### **3. Run the Application**
```bash
python app.py
```

Visit: http://localhost:5000

## **Troubleshooting Local Issues**

### **❌ "ModuleNotFoundError: No module named 'dotenv'"**
**Fix:**
```bash
pip install python-dotenv
```

### **❌ "Access blocked: authorisation error"**
**Fix:**
1. Check your `.env` file has correct Google OAuth credentials
2. Verify Google Console has `http://localhost:5000` in authorized origins
3. Verify Google Console has `http://localhost:5000/oauth2callback` in redirect URIs

### **❌ "Invalid redirect URI"**
**Fix:**
- Make sure `GOOGLE_REDIRECT_URI=http://localhost:5000/oauth2callback` in your `.env` file
- Check Google Console redirect URIs match exactly

### **❌ "Client ID not found"**
**Fix:**
- Copy the exact Client ID from Google Console
- No extra spaces in `.env` file

## **Environment Variables for Local Development**

### **Required Variables:**
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/oauth2callback
SECRET_KEY=your-secret-key
```

### **Optional Variables:**
```env
# Use file storage instead of MongoDB
USE_FILE_STORAGE=true

# MongoDB settings (if using MongoDB)
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/tradingview_screener
MONGODB_DB=tradingview_screener
```

## **Testing Local OAuth**

1. **Start the app:**
   ```bash
   python app.py
   ```

2. **Visit:** http://localhost:5000

3. **Click "Login"** - should redirect to Google OAuth

4. **After login** - should redirect back to localhost:5000

## **Common Local Development Commands**

```bash
# Check environment setup
python local_setup.py

# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py

# Test MongoDB connection (if using MongoDB)
python test_mongodb.py
```

## **Debug Mode**

The app runs in debug mode locally, so you'll see:
- ✅ Detailed error messages
- ✅ Auto-reload on file changes
- ✅ Environment variable loading status

## **File Structure for Local Development**

```
TradingViewAPI/
├── .env                    ← Your environment variables
├── app.py                  ← Main Flask app
├── local_setup.py          ← Local setup script
├── requirements.txt         ← Dependencies
├── templates/
│   ├── index.html          ← Main page
│   └── login.html          ← Login page
└── ...
```

## **Next Steps After Local Setup**

1. **Test OAuth login** - Make sure Google login works
2. **Test screener functionality** - Run a stock screener
3. **Test save/load screeners** - Save and load a screener
4. **Deploy to Render** - When ready for production

Your local development environment should now work with Google OAuth! 🚀 
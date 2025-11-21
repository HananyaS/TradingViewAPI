# TradingView Stock Screener API

A full-stack web application for building and executing stock screening strategies using the TradingView Screener API. Features include user authentication, strategy builder, watchlist management, trading journal, and live price updates.

## Features

- **Strategy Builder**: Create complex stock screening strategies with an intuitive interface
- **Watchlist**: Track your favorite stocks with live price updates
- **Trading Journal**: Record and analyze your trades with P&L calculations
- **User Authentication**: Secure Google OAuth2 authentication
- **Live Price Updates**: Real-time stock price updates for US exchanges
- **Profile Management**: Edit profile, view activity stats, and manage account

## Tech Stack

### Backend
- **Flask**: Python web framework
- **MongoDB**: Database for user data, trades, watchlist, and saved strategies
- **TradingView Screener API**: Stock data source
- **Google OAuth2**: User authentication

### Frontend
- **React**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling
- **React Router**: Navigation
- **React Hot Toast**: Notifications

## Prerequisites

- Python 3.8+
- Node.js 16+
- MongoDB (local or Atlas)
- Google OAuth2 credentials

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd TradingViewAPI
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Node.js dependencies

```bash
npm install
```

### 4. Environment Variables

Create a `.env` file in the root directory:

```env
# Flask
SECRET_KEY=your-secret-key-here
FLASK_ENV=development

# MongoDB
MONGODB_URL=mongodb://localhost:27017/
MONGODB_DB=tradingview_screener

# Google OAuth2
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Telegram Bot (if using)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

### 5. Google OAuth2 Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:5000/oauth2callback`
6. Copy Client ID and Client Secret to `.env`

### 6. MongoDB Setup

**Option 1: Local MongoDB**
```bash
# Install MongoDB locally or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Option 2: MongoDB Atlas**
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Get connection string
4. Update `MONGODB_URL` in `.env`

## Running the Application

### Development Mode

**Terminal 1 - Flask Backend:**
```bash
python app.py
```
Backend runs on `http://localhost:5000`

**Terminal 2 - React Frontend:**
```bash
npm run dev
```
Frontend runs on `http://localhost:5173`

### Production Mode

**Build React app:**
```bash
npm run build
```

**Run Flask:**
```bash
python app.py
```

## Project Structure

```
TradingViewAPI/
├── app.py                 # Main Flask application
├── screener_service.py    # TradingView screener logic
├── mongodb_config.py      # MongoDB connection and operations
├── google_oauth.py        # Google OAuth2 authentication
├── auth_tokens.py         # JWT token management
├── filter_schemas.py      # Pydantic schemas for API validation
├── filter_serializer.py   # Filter serialization
├── react_routes.py        # React app routes
├── telegram_bot.py        # Telegram bot (optional)
├── run_query.py           # Telegram bot query handler
├── commands.py            # Telegram bot commands
├── consts.py              # Constants
├── default_params.py      # Default screener parameters
├── utils.py               # Utility functions
├── file_storage.py        # File-based storage fallback
├── src/                   # React frontend
│   ├── pages/            # Page components
│   ├── components/       # Reusable components
│   ├── contexts/          # React contexts (Auth, Theme)
│   ├── hooks/            # Custom React hooks
│   └── utils/             # Utility functions
├── templates/             # HTML templates (legacy)
├── static/                # Static files
└── requirements.txt       # Python dependencies
```

## API Endpoints

### Authentication
- `GET /login` - Initiate Google OAuth login
- `GET /oauth2callback` - OAuth callback handler
- `POST /logout` - Logout user
- `GET /api/user` - Get current user info

### Profile
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile
- `GET /api/profile/stats` - Get user activity stats
- `DELETE /api/profile` - Delete user account

### Strategies
- `POST /api/screener` - Execute stock screener query
- `GET /api/query/list` - List saved strategies
- `POST /api/query/save` - Save a strategy
- `GET /api/query/load/<id>` - Load a strategy
- `DELETE /api/query/delete/<id>` - Delete a strategy

### Journal
- `GET /api/journal/trades` - Get user trades
- `POST /api/journal/trades` - Create a trade
- `PUT /api/journal/trades/<id>` - Update a trade
- `DELETE /api/journal/trades/<id>` - Delete a trade

### Watchlist
- `GET /api/watchlist/items` - Get watchlist items
- `POST /api/watchlist/items` - Add watchlist item
- `DELETE /api/watchlist/items/<id>` - Remove watchlist item

### Prices
- `GET /api/prices/cache` - Get cached prices
- `POST /api/prices/fetch` - Fetch live prices

## Development

### Code Style
- Python: Follow PEP 8
- JavaScript: Use ESLint configuration
- Use meaningful variable names
- Add comments for complex logic

### Testing
Run tests (when available):
```bash
pytest
```

## Deployment

### Render.com
1. Connect GitHub repository
2. Set environment variables
3. Build command: `npm run build`
4. Start command: `python app.py`

### Other Platforms
- Ensure MongoDB connection is configured
- Set all required environment variables
- Build React app: `npm run build`
- Run Flask app with production WSGI server (e.g., Gunicorn)

## Troubleshooting

### MongoDB Connection Issues
- Check `MONGODB_URL` in `.env`
- Verify MongoDB is running (local) or network access (Atlas)
- Check firewall settings

### OAuth Issues
- Verify redirect URI matches Google Console settings
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Ensure `OAUTHLIB_INSECURE_TRANSPORT=1` for local development

### React Build Issues
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 16+)

## License

[Your License Here]

## Contributing

[Contributing Guidelines Here]

## Support

[Support Information Here]


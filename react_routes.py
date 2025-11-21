import os
from flask import redirect, render_template, send_file, send_from_directory

def register_react_routes(app):
    # Check if we're in production (React app is built)
    is_production = os.path.exists('static/dist/index.html')
    
    if is_production:
        # Production: Serve built React app
        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve_react_app(path):
            """Serve React app for all routes (SPA routing)"""
            # Don't serve API routes, static assets, or auth routes through this
            if (path.startswith('api/') or 
                path.startswith('static/') or 
                path.startswith('login') or 
                path.startswith('oauth2callback') or 
                path.startswith('logout') or
                path.startswith('favicon.ico') or
                path.endswith('.svg') or
                path.endswith('.ico')):
                # Let Flask handle these routes - return None to continue routing
                return None
            
            # Serve index.html for all other routes (React Router will handle routing)
            try:
                return send_from_directory('static/dist', 'index.html')
            except Exception as e:
                # Fallback if file doesn't exist
                print(f"Error serving React app: {e}")
                return "React app not built. Run 'npm run build' first.", 404
        
        # Serve static assets from the build
        @app.route('/static/dist/<path:filename>')
        def serve_static_assets(filename):
            """Serve static assets from React build"""
            return send_from_directory('static/dist', filename)
        
        @app.route('/favicon.ico')
        def favicon():
            if os.path.exists('static/dist/favicon.ico'):
                return send_from_directory('static/dist', 'favicon.ico', mimetype='image/x-icon')
            return send_file('favicon.ico', mimetype='image/x-icon')
        
        @app.route('/trv_api_logo.svg')
        def logo():
            return send_file('trv_api_logo.svg', mimetype='image/svg+xml')
    else:
        # Development: Redirect to React dev server
        @app.route('/')
        def index():
            """Redirect to React development server"""
            return redirect('http://localhost:5173/')

        @app.route('/journal')
        def journal():
            return render_template('journal.html')

        @app.route('/watchlist')
        def watchlist():
            return render_template('watchlist.html')

        @app.route('/strategies')
        def strategies():
            return render_template('filter_builder.html')
        
        @app.route('/filter-builder')  # Keep for backward compatibility
        def filter_builder():
            return render_template('filter_builder.html')

        @app.route('/favicon.ico')
        def favicon():
            return send_file('favicon.ico', mimetype='image/x-icon')

        @app.route('/trv_api_logo.svg')
        def logo():
            return send_file('trv_api_logo.svg', mimetype='image/svg+xml')


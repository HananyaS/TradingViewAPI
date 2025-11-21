import os
from flask import redirect, render_template, send_file, send_from_directory

def register_react_routes(app):
    # Check if we're in production (React app is built)
    is_production = os.path.exists('static/dist/index.html')
    
    if is_production:
        # Production: Serve built React app
        # IMPORTANT: More specific routes must be registered BEFORE catch-all routes
        
        # Serve static assets from React build (Vite puts them in /assets/)
        @app.route('/assets/<path:filename>')
        def serve_react_assets(filename):
            """Serve static assets from React build"""
            try:
                return send_from_directory('static/dist/assets', filename)
            except Exception as e:
                print(f"Error serving asset {filename}: {e}")
                # Try to find the file in the dist root as fallback
                try:
                    return send_from_directory('static/dist', filename)
                except:
                    return "Asset not found", 404
        
        # Serve static files from dist root (for any other static files)
        @app.route('/static/dist/<path:filename>')
        def serve_static_assets(filename):
            """Serve static assets from React build"""
            return send_from_directory('static/dist', filename)
        
        # Serve favicon
        @app.route('/favicon.ico')
        def favicon():
            if os.path.exists('static/dist/favicon.ico'):
                return send_from_directory('static/dist', 'favicon.ico', mimetype='image/x-icon')
            return send_file('favicon.ico', mimetype='image/x-icon')
        
        # Serve logo
        @app.route('/trv_api_logo.svg')
        def logo():
            return send_file('trv_api_logo.svg', mimetype='image/svg+xml')
        
        # Serve index.html for SPA routes (catch-all, must be LAST)
        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve_react_app(path):
            """Serve React app for all routes (SPA routing)"""
            # Don't serve API routes or auth routes through this
            if (path.startswith('api/') or 
                path.startswith('login') or 
                path.startswith('oauth2callback') or 
                path.startswith('logout')):
                # These should be handled by Flask API routes, return 404 if not found
                from flask import abort
                abort(404)
            
            # Don't serve static assets here (handled by routes above)
            if path.startswith('assets/') or path.startswith('static/'):
                from flask import abort
                abort(404)
            
            # Serve index.html for all other routes (React Router will handle routing)
            try:
                return send_from_directory('static/dist', 'index.html')
            except Exception as e:
                # Fallback if file doesn't exist
                print(f"Error serving React app: {e}")
                return "React app not built. Run 'npm run build' first.", 404
        
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


from flask import redirect, render_template, send_file


def register_react_routes(app):
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


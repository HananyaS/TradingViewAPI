from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
import io
import datetime
import pandas as pd
import math
import urllib.parse
from run_query import query_by_params
from mongodb_config import mongodb_manager
import os

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    return send_file('favicon.ico', mimetype='image/x-icon')

@app.route('/api/query', methods=['POST'])
def api_query():
    try:
        data = request.get_json()
        
        # Extract parameters from request
        us_exchanges_only = data.get('us_exchanges_only', True)
        min_price = data.get('min_price')
        min_relative_volume = data.get('min_relative_volume')
        min_change = data.get('min_change')
        min_sma20_above_pct = data.get('min_sma20_above_pct')
        min_atr_pct = data.get('min_atr_pct')
        min_adr_pct = data.get('min_adr_pct')
        filter_out_otc = data.get('filter_out_otc', True)
        bullish_candlestick_patterns_only = data.get('bullish_candlestick_patterns_only', False)
        

        
        # Call the existing query function
        results = query_by_params(
            us_exchanges_only=us_exchanges_only,
            min_price=min_price,
            min_relative_volume=min_relative_volume,
            min_change=min_change,
            min_sma20_above_pct=min_sma20_above_pct,
            min_atr_pct=min_atr_pct,
            min_adr_pct=min_adr_pct,
            filter_out_otc=filter_out_otc,
            bullish_candlestick_patterns_only=bullish_candlestick_patterns_only
        )
        
        if results.empty:
            return jsonify({
                'success': False,
                'message': 'No symbols found matching the criteria.',
                'count': 0
            })
        
        # Create TradingView links for stock names
        def create_tradingview_link(row):
            symbol = row['name']
            exchange = row['exchange']
            
            # Map exchange names to TradingView format
            exchange_mapping = {
                'NASDAQ': 'NASDAQ',
                'NYSE': 'NYSE',
                'NYSE AMERICAN': 'NYSEAMERICAN',
                'NYSE ARCA': 'NYSEARCA',
                'CBOE': 'CBOE',
                'CBOE BZX': 'CBOEBZX',
                'CBOE BYX': 'CBOEBYX',
                'CBOE EDGX': 'CBOEEDGX',
                'CBOE EDGA': 'CBOEEDGA',
                'IEX': 'IEX',
                'OTC': 'OTC',
                'OTC MARKETS': 'OTCMARKETS',
                'PHILADELPHIA STOCK EXCHANGE': 'PHLX',
                'NYSE CHICAGO': 'NYSECHICAGO',
                'NATIONAL STOCK EXCHANGE': 'NSX',
                'NASDAQBX': 'NASDAQBX',
                'BATS': 'BATS',
                'INSTINET': 'INSTINET'
            }
            
            tv_exchange = exchange_mapping.get(exchange, exchange)
            
            # Create a more mobile-friendly TradingView link
            # Use the symbol format that works better with mobile apps
            # Format: EXCHANGE-SYMBOL (with hyphen, not colon)
            symbol_pair = f"{tv_exchange}-{symbol}"
            encoded_symbol = urllib.parse.quote(symbol_pair)
            
            # Use the format that works with mobile apps, including UTM parameters
            return f"https://www.tradingview.com/symbols/{encoded_symbol}/?utm_source=androidapp&utm_medium=share"
        
        # Add TradingView links to the results
        results['tradingview_link'] = results.apply(create_tradingview_link, axis=1)
        
        # Create CSV buffer (without tradingview_link column for cleaner CSV)
        csv_export_df = results.drop(columns=['tradingview_link'])
        csv_buffer = io.StringIO()
        csv_export_df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)
        
        # Prepare all data (replace NaN/NA with None)
        all_data_df = results.replace({pd.NA: None, float('nan'): None, math.nan: None})
        all_data = all_data_df.to_dict(orient='records')
        # Remove tradingview_link column from display columns but keep it in the data for links
        display_columns = [col for col in results.columns if col != 'tradingview_link']
        
        # Create response with CSV data and all results
        response_data = {
            'success': True,
            'count': len(results),
            'message': f'Found {len(results)} symbols!',
            'csv_data': csv_buffer.getvalue(),
            'filename': f"screener_results_{datetime.datetime.today().strftime('%Y%m%d')}.csv",
            'data': all_data,
            'columns': display_columns
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error processing query: {str(e)}',
            'count': 0
        }), 500

@app.route('/api/download', methods=['POST'])
def download_csv():
    try:
        data = request.get_json()
        csv_data = data.get('csv_data')
        filename = data.get('filename', 'screener_results.csv')
        
        if not csv_data:
            return jsonify({'error': 'No CSV data provided'}), 400
        
        # Create BytesIO buffer for file download
        buffer = io.BytesIO()
        buffer.write(csv_data.encode('utf-8'))
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype='text/csv'
        )
        
    except Exception as e:
        return jsonify({'error': f'Error creating download: {str(e)}'}), 500

@app.route('/api/screeners', methods=['GET'])
def get_screeners():
    """Get all saved screeners"""
    try:
        search_term = request.args.get('search', '')
        if search_term:
            screeners = mongodb_manager.search_screeners(search_term)
        else:
            screeners = mongodb_manager.get_all_screeners()
        
        return jsonify({
            'success': True,
            'screeners': screeners
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error retrieving screeners: {str(e)}'
        }), 500

@app.route('/api/screeners', methods=['POST'])
def save_screener():
    """Save a new screener"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'owner', 'params']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'success': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Handle optional tags
        tags = data.get('tags', '').strip()
        if not tags:
            tags = ''  # Empty string for no tags
        
        # Save screener
        screener_id = mongodb_manager.save_screener(
            name=data['name'],
            owner=data['owner'],
            tags=data['tags'],
            params=data['params']
        )
        
        return jsonify({
            'success': True,
            'message': 'Screener saved successfully!',
            'screener_id': screener_id
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error saving screener: {str(e)}'
        }), 500

@app.route('/api/screeners/<screener_id>', methods=['GET'])
def get_screener(screener_id):
    """Get a specific screener by ID"""
    try:
        screener = mongodb_manager.get_screener_by_id(screener_id)
        if screener:
            return jsonify({
                'success': True,
                'screener': screener
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Screener not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error retrieving screener: {str(e)}'
        }), 500

@app.route('/api/screeners/<screener_id>', methods=['DELETE'])
def delete_screener(screener_id):
    """Delete a screener"""
    try:
        data = request.get_json()
        confirmation_name = data.get('confirmation_name', '')
        
        # Get the screener to check the name
        screener = mongodb_manager.get_screener_by_id(screener_id)
        if not screener:
            return jsonify({
                'success': False,
                'message': 'Screener not found'
            }), 404
        
        # Check if confirmation name matches
        if confirmation_name != screener['name']:
            return jsonify({
                'success': False,
                'message': 'Confirmation name does not match screener name'
            }), 400
        
        # Delete the screener
        success = mongodb_manager.delete_screener(screener_id)
        if success:
            return jsonify({
                'success': True,
                'message': 'Screener deleted successfully!'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Error deleting screener'
            }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error deleting screener: {str(e)}'
        }), 500

if __name__ == '__main__':
    # Debug MongoDB connection
    print("=== MongoDB Connection Debug ===")
    print(f"MONGODB_URL: {os.getenv('MONGODB_URL', 'Not set')[:50]}...")
    print(f"MONGODB_DB: {os.getenv('MONGODB_DB', 'Not set')}")
    print(f"USE_FALLBACK_ONLY: {os.getenv('USE_FALLBACK_ONLY', 'false')}")
    print(f"USE_FILE_STORAGE: {os.getenv('USE_FILE_STORAGE', 'false')}")
    print("================================")
    
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
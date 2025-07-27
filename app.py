from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
import io
import datetime
import pandas as pd
import math
import urllib.parse
from run_query import query_by_params

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

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
                'NASDAQ BX': 'NASDAQBX',
                'BATS': 'BATS',
                'INSTINET': 'INSTINET'
            }
            
            tv_exchange = exchange_mapping.get(exchange, exchange)
            encoded_symbol = urllib.parse.quote(f"{tv_exchange}:{symbol}")
            return f"https://www.tradingview.com/chart/AL0YYsq6/?symbol={encoded_symbol}"
        
        # Add TradingView links to the results
        results['tradingview_link'] = results.apply(create_tradingview_link, axis=1)
        
        # Create CSV buffer (without tradingview_link column for cleaner CSV)
        csv_export_df = results.drop(columns=['tradingview_link'])
        csv_buffer = io.StringIO()
        csv_export_df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)
        
        # Prepare preview (first 10 rows as list of dicts, replace NaN/NA with None)
        preview_df = results.head(10).replace({pd.NA: None, float('nan'): None, math.nan: None})
        preview = preview_df.to_dict(orient='records')
        # Remove tradingview_link column from preview columns but keep it in the data for links
        preview_columns = [col for col in results.columns if col != 'tradingview_link']
        
        # Create response with CSV data and preview
        response_data = {
            'success': True,
            'count': len(results),
            'message': f'Found {len(results)} symbols!',
            'csv_data': csv_buffer.getvalue(),
            'filename': f"screener_results_{datetime.datetime.today().strftime('%Y%m%d')}.csv",
            'preview': preview,
            'columns': preview_columns
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
# 🔍 Dynamic Filter Builder for TradingView Screener

A comprehensive, flexible filter builder system that allows users to create complex stock screening queries with an intuitive UI and powerful backend processing.

## 🏗️ Architecture Overview

```
Frontend (Vanilla JS)          Backend (Flask + Pydantic)     External API
┌─────────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│   FilterBuilder     │──────▶│  /api/screener       │──────▶│  TradingView    │
│   Component         │       │  (POST)              │       │  Screener API   │
│                     │       │                      │       │                 │
│ • Field metadata    │       │ • Filter validation  │       │ • Stock data    │
│ • Nested logic      │       │ • Serialization      │       │ • Real-time     │
│ • Rule builder UI   │       │ • API forwarding     │       │   prices        │
│ • AND/OR groups     │       │ • Response mapping   │       │                 │
└─────────────────────┘       └──────────────────────┘       └─────────────────┘
```

## 🚀 Key Features

### Frontend Features
- **Searchable Field Dropdowns**: Fields grouped by category (Price, Volume, Technical Indicators, etc.)
- **Dynamic Operators**: Operator selection changes based on field type (number, string, enum)
- **Field Comparisons**: Compare field ↔ field or field ↔ constant values
- **Nested Logic Groups**: Support for complex AND/OR combinations with unlimited nesting
- **Real-time Preview**: Live preview of filter logic and JSON structure
- **Responsive Design**: Works on desktop and mobile devices

### Backend Features
- **Pydantic Validation**: Robust request validation and error handling
- **Flexible Serialization**: Convert dynamic filters to TradingView API format
- **Legacy Compatibility**: Backward compatibility with existing query_by_params function
- **Field Metadata**: Centralized field definitions with type information
- **Error Handling**: Comprehensive error reporting and logging

## 📁 File Structure

```
├── Backend (Flask)
│   ├── filter_schemas.py      # Pydantic schemas for validation
│   ├── filter_serializer.py   # Filter serialization logic
│   └── app.py                 # Flask routes (updated)
│
├── Frontend (Vanilla JS)
│   ├── static/
│   │   ├── FilterBuilder.js   # Main component
│   │   ├── FilterBuilder.css  # Styling
│   │   ├── apiClient.js       # API communication
│   │   ├── types.ts           # TypeScript definitions
│   │   └── fields.json        # Field metadata
│   └── templates/
│       └── filter_builder.html # Integration page
│
├── Testing & Examples
│   ├── test_filter_system.py  # Comprehensive tests
│   └── convert_fields.py      # Excel to JSON converter
│
└── Documentation
    └── DYNAMIC_FILTER_BUILDER.md # This file
```

## 🛠️ Installation & Setup

### 1. Install Dependencies

```bash
# Install Python dependencies
pip install pydantic

# Ensure you have the existing dependencies
pip install -r requirements.txt
```

### 2. Convert Field Metadata (if needed)

```bash
# Convert Excel metadata to JSON
python convert_fields.py
```

### 3. Start the Flask Server

```bash
python app.py
```

### 4. Access the Filter Builder

Visit: `http://localhost:5000/filter-builder`

## 📊 API Endpoints

### GET `/api/fields`
Returns field metadata for the filter builder.

**Response:**
```json
{
  "success": true,
  "data": {
    "fields": [...],
    "grouped_fields": {...},
    "groups": [...]
  }
}
```

### POST `/api/screener`
Submits a dynamic screener request.

**Request:**
```json
{
  "filter_groups": [
    {
      "id": "group1",
      "logical_operator": "AND",
      "rules": [
        {
          "id": "rule1",
          "left_operand": {
            "type": "field",
            "value": "close",
            "field_type": "number"
          },
          "operator": "greater_than",
          "right_operand": {
            "type": "constant",
            "value": 10.0
          },
          "enabled": true
        }
      ],
      "nested_groups": [],
      "enabled": true
    }
  ],
  "columns": ["name", "close", "change"],
  "limit": 100,
  "sort_by": "market_cap_basic",
  "sort_ascending": false
}
```

**Response:**
```json
{
  "success": true,
  "count": 42,
  "data": [...],
  "columns": [...],
  "message": "Found 42 symbols using dynamic filters!",
  "csv_data": "...",
  "filename": "dynamic_screener_results_20241207.csv"
}
```

## 🎯 Usage Examples

### Example 1: Simple Price Filter
```javascript
// Filter: close > $10
{
  "filter_groups": [{
    "id": "group1",
    "logical_operator": "AND",
    "rules": [{
      "id": "rule1",
      "left_operand": {
        "type": "field",
        "value": "close",
        "field_type": "number"
      },
      "operator": "greater_than",
      "right_operand": {
        "type": "constant", 
        "value": 10.0
      },
      "enabled": true
    }],
    "nested_groups": [],
    "enabled": true
  }]
}
```

### Example 2: Complex Nested Logic
```javascript
// Filter: (close > open AND RSI < 70) OR (volume > 1M AND change > 5%)
{
  "filter_groups": [{
    "id": "main_group",
    "logical_operator": "OR",
    "rules": [],
    "nested_groups": [
      {
        "id": "bullish_group",
        "logical_operator": "AND",
        "rules": [
          // close > open
          {
            "left_operand": {"type": "field", "value": "close"},
            "operator": "field_greater_than",
            "right_operand": {"type": "field", "value": "open"}
          },
          // RSI < 70
          {
            "left_operand": {"type": "field", "value": "RSI"},
            "operator": "less_than", 
            "right_operand": {"type": "constant", "value": 70}
          }
        ]
      },
      {
        "id": "momentum_group", 
        "logical_operator": "AND",
        "rules": [
          // volume > 1M
          {
            "left_operand": {"type": "field", "value": "volume"},
            "operator": "greater_than",
            "right_operand": {"type": "constant", "value": 1000000}
          },
          // change > 5%
          {
            "left_operand": {"type": "field", "value": "change"},
            "operator": "greater_than",
            "right_operand": {"type": "constant", "value": 5.0}
          }
        ]
      }
    ]
  }]
}
```

### Example 3: Field-to-Field Comparison
```javascript
// Filter: close > open (bullish candle)
{
  "filter_groups": [{
    "rules": [{
      "left_operand": {
        "type": "field",
        "value": "close",
        "field_type": "number"
      },
      "operator": "field_greater_than",
      "right_operand": {
        "type": "field",
        "value": "open"
      }
    }]
  }]
}
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
python test_filter_system.py
```

This will test:
- ✅ Pydantic schema validation
- ✅ Filter serialization logic
- ✅ API endpoint functionality
- ✅ Example filter creation

## 🔧 Customization

### Adding New Field Types

1. **Update `static/fields.json`** with new field definitions
2. **Add operators** in `filter_schemas.py` → `get_operators_for_type()`
3. **Update serialization** in `filter_serializer.py` → `_serialize_filter_rule()`
4. **Add frontend support** in `FilterBuilder.js` → `getOperatorsForType()`

### Adding New Operators

1. **Define operator** in `filter_schemas.py` → `OperatorType` enum
2. **Add serialization logic** in `filter_serializer.py`
3. **Update frontend** in `static/types.ts` and `apiClient.js`
4. **Add UI labels** in `FilterBuilder.js`

### Styling Customization

Modify `static/FilterBuilder.css` to customize:
- Color scheme
- Layout and spacing
- Responsive breakpoints
- Dark mode support

## 🚀 Advanced Features

### Saved Filters
The system integrates with the existing screener save/load functionality. Users can:
- Save complex filter configurations
- Load and modify existing filters
- Share filters with other users

### Export Options
- **CSV Export**: Download complete results as CSV
- **JSON Export**: Export filter configuration for backup/sharing
- **TradingView Links**: Direct links to symbols in TradingView

### Performance Optimization
- **Field Caching**: Field metadata is cached for fast loading
- **Lazy Loading**: Large result sets are paginated
- **Debounced Updates**: Real-time preview updates are debounced

## 🐛 Troubleshooting

### Common Issues

**1. Field metadata not loading**
```bash
# Check if fields.json exists
ls static/fields.json

# Regenerate if needed
python convert_fields.py
```

**2. API endpoints returning 500 errors**
```bash
# Check Flask logs for detailed error messages
# Ensure all dependencies are installed
pip install pydantic
```

**3. Frontend not rendering**
```bash
# Check browser console for JavaScript errors
# Ensure all static files are accessible
# Verify Flask is serving static files correctly
```

**4. Filters not working as expected**
```bash
# Test with simple filters first
# Check the JSON preview for correct structure
# Validate against the schema using test_filter_system.py
```

## 🔮 Future Enhancements

### Planned Features
- [ ] **Visual Query Builder**: Drag-and-drop interface
- [ ] **Filter Templates**: Pre-built filter templates for common strategies
- [ ] **Real-time Updates**: Live updating results as filters change
- [ ] **Advanced Charting**: Integration with TradingView charts
- [ ] **Backtesting**: Historical performance of filter criteria
- [ ] **Alerts**: Email/SMS alerts when filters match new stocks

### Technical Improvements
- [ ] **Full TradingView API Integration**: Direct Query object serialization
- [ ] **Caching Layer**: Redis caching for improved performance
- [ ] **WebSocket Support**: Real-time filter result updates
- [ ] **GraphQL API**: More flexible API queries
- [ ] **TypeScript Migration**: Full TypeScript frontend

## 📚 Additional Resources

- **TradingView Screener API**: [Documentation](https://github.com/shner-elmo/TradingView-Screener)
- **Pydantic Documentation**: [pydantic-docs.helpmanual.io](https://pydantic-docs.helpmanual.io/)
- **Flask Documentation**: [flask.palletsprojects.com](https://flask.palletsprojects.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit a pull request

## 📄 License

This project is part of the TradingView Screener API application. See the main project license for details.

---

**Built with ❤️ for traders who need powerful, flexible stock screening tools.**

"""
Filter serialization logic for TradingView API format
"""
from typing import List, Dict, Any, Optional
from filter_schemas import (
    ScreenerRequest, FilterGroup, FilterRule, OperatorType, 
    LogicalOperator, FieldMetadata
)
from tradingview_screener import Query, Column
import json


class FilterSerializer:
    """Converts dynamic filters to TradingView Screener API format"""
    
    def __init__(self, field_metadata: Dict[str, FieldMetadata]):
        self.field_metadata = field_metadata
        
    def serialize_screener_request(self, request: ScreenerRequest) -> Query:
        """Convert ScreenerRequest to TradingView Query object"""
        # Start with base query
        query = Query()
        
        # Add columns if specified
        if request.columns:
            print(f"📊 Using custom columns: {request.columns}")
            # Validate all columns are strings
            valid_columns = []
            for col in request.columns:
                if isinstance(col, str) and col.strip():
                    valid_columns.append(col)
                else:
                    print(f"⚠️ Skipping invalid column: '{col}' (type: {type(col)})")
            
            if valid_columns:
                query = query.select(*valid_columns)
            else:
                print(f"⚠️ No valid columns found, using defaults")
                # Fall back to defaults
                default_columns = [
                    'name', 'exchange', 'close', 'change', 'volume',
                    'SMA20', 'relative_volume', 'market_cap_basic',
                    'ATR', 'RSI', 'BB.lower', 'BB.upper'
                ]
                query = query.select(*default_columns)
        else:
            # Use default columns from existing implementation
            default_columns = [
                'name', 'exchange', 'close', 'change', 'volume',
                'SMA20', 'relative_volume', 'market_cap_basic',
                'ATR', 'RSI', 'BB.lower', 'BB.upper'
            ]
            print(f"📊 Using default columns: {default_columns}")
            query = query.select(*default_columns)
        
        # Convert filter groups to TradingView filters
        filters = []
        for i, group in enumerate(request.filter_groups):
            if group.enabled:
                print(f"🔍 Processing filter group {i}: {group.id}")
                try:
                    group_filters = self._serialize_filter_group(group)
                    print(f"   Group filters result: {type(group_filters)} with {len(group_filters) if hasattr(group_filters, '__len__') else 'unknown'} items")
                    
                    # Just log the type without iterating
                    print(f"   Group filters type: {type(group_filters)}")
                    
                    if isinstance(group_filters, list):
                        # Filter out None values (from unsupported operators)
                        valid_filters = [f for f in group_filters if f is not None]
                        if len(valid_filters) < len(group_filters):
                            print(f"   ⚠️ Filtered out {len(group_filters) - len(valid_filters)} None/unsupported filters")
                        filters.extend(valid_filters)
                    else:
                        if group_filters is not None:
                            filters.append(group_filters)
                        else:
                            print(f"   ⚠️ Skipping None filter")
                    print(f"   Total filters so far: {len(filters)}")
                except Exception as e:
                    print(f"❌ Error processing group {i}: {e}")
                    raise
        
        # Apply filters to query
        if filters:
            print(f"📌 Applying {len(filters)} filter conditions to query:")
            for i, f in enumerate(filters):
                print(f"   Filter {i+1}: {f}")
            query = query.where(*filters)
        else:
            print(f"⚠️ No filters to apply!")
        
        # Apply sorting
        if request.sort_by:
            query = query.order_by(request.sort_by, ascending=request.sort_ascending)
        
        # Apply limit - use reasonable default if None
        if request.limit and isinstance(request.limit, int) and request.limit > 0:
            print(f"📊 Applying limit: {request.limit}")
            query = query.limit(request.limit)
        else:
            # TradingView has a default limit of 50, so we need to explicitly set a higher limit
            # Use 1000 as a reasonable default (not too high to cause timeouts)
            default_limit = 1000
            print(f"📊 No limit specified - applying default limit: {default_limit}")
            query = query.limit(default_limit)
        
        print(f"🏁 Query built successfully")
        return query
    
    def _serialize_filter_group(self, group: FilterGroup) -> List:
        """Convert a FilterGroup to TradingView filter conditions"""
        print(f"🔍 Serializing filter group: {group.id}")
        print(f"   Rules: {len(group.rules)}, Nested groups: {len(group.nested_groups)}")
        print(f"   Logical operator: {group.logical_operator}")
        
        # Process individual rules
        rule_conditions = []
        for i, rule in enumerate(group.rules):
            if rule.enabled:
                print(f"   Processing rule {i}: {rule.id}")
                condition = self._serialize_filter_rule(rule)
                print(f"   Rule {i} result: {type(condition)}")
                if condition is not None:
                    rule_conditions.append(condition)
        
        print(f"   Rule conditions collected: {len(rule_conditions)}")
        
        # Process nested groups recursively
        nested_conditions = []
        for i, nested_group in enumerate(group.nested_groups):
            if nested_group.enabled:
                print(f"   Processing nested group {i}")
                nested_group_conditions = self._serialize_filter_group(nested_group)
                if not isinstance(nested_group_conditions, list):
                    raise ValueError(f"Nested group returned non-list: {type(nested_group_conditions)}")
                nested_conditions.extend(nested_group_conditions)
        
        print(f"   Nested conditions collected: {len(nested_conditions)}")
        
        # Combine all conditions for this group
        all_conditions = rule_conditions + nested_conditions
        print(f"   Total conditions: {len(all_conditions)}")
        
        if not all_conditions:
            print(f"   No conditions, returning empty list")
            return []
        
        # Handle logical operators
        if group.logical_operator == LogicalOperator.AND:
            # For AND, return all conditions separately (TradingView combines with AND by default)
            print(f"   AND logic: returning {len(all_conditions)} conditions")
            return all_conditions
        elif group.logical_operator == LogicalOperator.OR:
            # For OR, we need to combine conditions using | operator
            if len(all_conditions) == 1:
                print(f"   OR logic: single condition, returning as-is")
                return all_conditions
            else:
                print(f"   OR logic: combining {len(all_conditions)} conditions")
                # Combine all conditions with OR
                combined_condition = all_conditions[0]
                for condition in all_conditions[1:]:
                    combined_condition = combined_condition or condition
                return [combined_condition]
        
        print(f"   Default: returning {len(all_conditions)} conditions")
        return all_conditions
    
    def _serialize_filter_rule(self, rule: FilterRule) -> Optional[Any]:
        """Convert a FilterRule to TradingView filter condition"""
        try:
            # Debug logging
            print(f"🔍 Serializing rule: {rule.id}")
            print(f"   Left operand: {rule.left_operand.type} = '{rule.left_operand.value}'")
            print(f"   Operator: {rule.operator}")
            print(f"   Right operand: {rule.right_operand.type} = '{rule.right_operand.value}'")
            
            # Get left operand (must be a field for TradingView API)
            if rule.left_operand.type != "field":
                raise ValueError("Left operand must be a field for TradingView API")
            
            field_name = rule.left_operand.value
            
            # Validate field name is a string
            if not isinstance(field_name, str) or not field_name.strip():
                raise ValueError(f"Invalid field name: '{field_name}' (type: {type(field_name)})")
            
            print(f"   Creating Column for field: '{field_name}'")
            column = Column(field_name)
            
            # Get right operand value
            right_value = rule.right_operand.value
            print(f"   Right value: '{right_value}' (type: {type(right_value)})")
            
            # Convert operator to TradingView condition
            if rule.operator == OperatorType.EQUALS:
                print(f"   Building condition: {field_name} == {right_value}")
                # Special handling for exchange field - must be uppercase
                if field_name.lower() == 'exchange' and isinstance(right_value, str):
                    right_value = right_value.upper().strip()
                    print(f"   ⚠️ Exchange filter - normalized value to: '{right_value}'")
                return column == right_value
            elif rule.operator == OperatorType.NOT_EQUALS:
                print(f"   Building condition: {field_name} != {right_value}")
                return column != right_value
            elif rule.operator == OperatorType.GREATER_THAN:
                print(f"   Building condition: {field_name} > {right_value}")
                # Validate numeric value for comparison operators
                if not isinstance(right_value, (int, float)):
                    try:
                        right_value = float(right_value)
                        print(f"   Converted right_value to float: {right_value}")
                    except (ValueError, TypeError):
                        raise ValueError(f"Invalid numeric value for > operator: '{right_value}' (type: {type(right_value)})")
                return column > right_value
            elif rule.operator == OperatorType.GREATER_THAN_OR_EQUAL:
                print(f"   Building condition: {field_name} >= {right_value}")
                if not isinstance(right_value, (int, float)):
                    try:
                        right_value = float(right_value)
                        print(f"   Converted right_value to float: {right_value}")
                    except (ValueError, TypeError):
                        raise ValueError(f"Invalid numeric value for >= operator: '{right_value}' (type: {type(right_value)})")
                return column >= right_value
            elif rule.operator == OperatorType.LESS_THAN:
                print(f"   Building condition: {field_name} < {right_value}")
                if not isinstance(right_value, (int, float)):
                    try:
                        right_value = float(right_value)
                        print(f"   Converted right_value to float: {right_value}")
                    except (ValueError, TypeError):
                        raise ValueError(f"Invalid numeric value for < operator: '{right_value}' (type: {type(right_value)})")
                return column < right_value
            elif rule.operator == OperatorType.LESS_THAN_OR_EQUAL:
                print(f"   Building condition: {field_name} <= {right_value}")
                if not isinstance(right_value, (int, float)):
                    try:
                        right_value = float(right_value)
                        print(f"   Converted right_value to float: {right_value}")
                    except (ValueError, TypeError):
                        raise ValueError(f"Invalid numeric value for <= operator: '{right_value}' (type: {type(right_value)})")
                return column <= right_value
            elif rule.operator == OperatorType.BETWEEN:
                # Expect right_value to be a list [min, max]
                if isinstance(right_value, list) and len(right_value) == 2:
                    return (column >= right_value[0]) and (column <= right_value[1])
                else:
                    raise ValueError("BETWEEN operator requires array of [min, max] values")
            elif rule.operator == OperatorType.IN:
                # Special handling for exchange field - must be uppercase
                if field_name.lower() == 'exchange':
                    if isinstance(right_value, list):
                        right_value = [v.upper().strip() if isinstance(v, str) else v for v in right_value]
                    elif isinstance(right_value, str):
                        right_value = [right_value.upper().strip()]
                    print(f"   ⚠️ Exchange IN filter - normalized values to: {right_value}")
                
                if isinstance(right_value, list):
                    return column.isin(right_value)
                else:
                    return column.isin([right_value])
            elif rule.operator == OperatorType.NOT_IN:
                if isinstance(right_value, list):
                    return ~column.isin(right_value)
                else:
                    return ~column.isin([right_value])
            elif rule.operator in [OperatorType.CONTAINS, OperatorType.NOT_CONTAINS, OperatorType.STARTS_WITH, OperatorType.ENDS_WITH]:
                # TradingView API doesn't support pattern matching for text fields
                # Fall back to exact match for CONTAINS/STARTS_WITH/ENDS_WITH
                print(f"   ⚠️ WARNING: {rule.operator} not supported by TradingView, using EQUALS instead")
                print(f"   Building condition: {field_name} == '{right_value}'")
                if rule.operator == OperatorType.NOT_CONTAINS:
                    return column != right_value
                else:
                    return column == right_value
            elif rule.operator == OperatorType.FIELD_EQUALS:
                # Field-to-field comparison
                if rule.right_operand.type == "field":
                    right_field_name = rule.right_operand.value
                    # Validate right field name
                    if not isinstance(right_field_name, str) or not right_field_name.strip():
                        raise ValueError(f"Invalid right field name: '{right_field_name}' (type: {type(right_field_name)})")
                    print(f"   Building condition: {field_name} == {right_field_name}")
                    right_column = Column(right_field_name)
                    return column == right_column
                else:
                    raise ValueError("FIELD_EQUALS requires right operand to be a field")
            elif rule.operator == OperatorType.FIELD_GREATER_THAN:
                if rule.right_operand.type == "field":
                    right_field_name = rule.right_operand.value
                    # Validate right field name
                    if not isinstance(right_field_name, str) or not right_field_name.strip():
                        raise ValueError(f"Invalid right field name: '{right_field_name}' (type: {type(right_field_name)})")
                    print(f"   Building condition: {field_name} > {right_field_name}")
                    right_column = Column(right_field_name)
                    return column > right_column
                else:
                    raise ValueError("FIELD_GREATER_THAN requires right operand to be a field")
            elif rule.operator == OperatorType.FIELD_LESS_THAN:
                if rule.right_operand.type == "field":
                    right_field_name = rule.right_operand.value
                    # Validate right field name
                    if not isinstance(right_field_name, str) or not right_field_name.strip():
                        raise ValueError(f"Invalid right field name: '{right_field_name}' (type: {type(right_field_name)})")
                    print(f"   Building condition: {field_name} < {right_field_name}")
                    right_column = Column(right_field_name)
                    return column < right_column
                else:
                    raise ValueError("FIELD_LESS_THAN requires right operand to be a field")
            elif rule.operator == OperatorType.FIELD_GREATER_THAN_BY_PERCENT:
                # Use TradingView's above_pct method: field_a.above_pct(field_b, percentage)
                if rule.right_operand.type == "field":
                    # Extract field and percentage from right operand
                    # Format: {"field": "field_name", "percentage": 5.0}
                    if isinstance(rule.right_operand.value, dict):
                        right_field = rule.right_operand.value.get("field")
                        percentage = rule.right_operand.value.get("percentage", 0)
                        return column.above_pct(right_field, percentage)
                    else:
                        raise ValueError("FIELD_GREATER_THAN_BY_PERCENT requires field and percentage")
                else:
                    raise ValueError("FIELD_GREATER_THAN_BY_PERCENT requires field operand")
            elif rule.operator == OperatorType.FIELD_LESS_THAN_BY_PERCENT:
                # Use TradingView's below_pct method (if available) or manual calculation
                if rule.right_operand.type == "field":
                    # Extract field and percentage from right operand
                    if isinstance(rule.right_operand.value, dict):
                        right_field = rule.right_operand.value.get("field")
                        percentage = rule.right_operand.value.get("percentage", 0)
                        right_column = Column(right_field)
                        # TradingView might not have below_pct, so use manual calculation
                        # field_a < field_b * (1 - percentage/100)
                        return column < right_column * (1 - percentage / 100)
                    else:
                        raise ValueError("FIELD_LESS_THAN_BY_PERCENT requires field and percentage")
                else:
                    raise ValueError("FIELD_LESS_THAN_BY_PERCENT requires field operand")
            else:
                raise ValueError(f"Unsupported operator: {rule.operator}")
                
        except Exception as e:
            print(f"❌ Error serializing filter rule {rule.id}: {e}")
            print(f"   Rule details: {rule.left_operand.value} {rule.operator} {rule.right_operand.value}")
            import traceback
            traceback.print_exc()
            return None
    
    def serialize_to_legacy_params(self, request: ScreenerRequest) -> Dict[str, Any]:
        """
        Convert ScreenerRequest to legacy parameter format for backward compatibility
        This allows the new dynamic filters to work with the existing query_by_params function
        """
        params = {
            'us_exchanges_only': True,  # Default
            'filter_out_otc': True,     # Default
            'bullish_candlestick_patterns_only': False,  # Default
            # Initialize all expected parameters to None to avoid KeyError
            'min_price': None,
            'min_relative_volume': None,
            'min_change': None,
            'max_change': None,
            'min_sma20_above_pct': None,
            'min_atr_pct': None,
            'min_adr_pct': None,
            'min_rsi': None,
            'max_rsi': None,
            'min_bb_percent_b': None,
            'max_bb_percent_b': None,
        }
        
        # Extract common parameters from filter rules
        for group in request.filter_groups:
            if not group.enabled:
                continue
                
            for rule in group.rules:
                if not rule.enabled or rule.left_operand.type != "field":
                    continue
                
                field_name = rule.left_operand.value
                value = rule.right_operand.value
                
                # Map common fields to legacy parameters
                if field_name == "close" and rule.operator == OperatorType.GREATER_THAN_OR_EQUAL:
                    params['min_price'] = value
                elif field_name == "relative_volume" and rule.operator == OperatorType.GREATER_THAN:
                    params['min_relative_volume'] = value
                elif field_name == "change" and rule.operator == OperatorType.GREATER_THAN:
                    params['min_change'] = value
                elif field_name == "change" and rule.operator == OperatorType.LESS_THAN:
                    params['max_change'] = value
                elif field_name == "RSI" and rule.operator == OperatorType.GREATER_THAN_OR_EQUAL:
                    params['min_rsi'] = value
                elif field_name == "RSI" and rule.operator == OperatorType.LESS_THAN_OR_EQUAL:
                    params['max_rsi'] = value
                # Add more mappings as needed
        
        return params


def create_sample_request() -> ScreenerRequest:
    """Create a sample screener request for testing"""
    from filter_schemas import FilterGroup, FilterRule, FilterOperand, OperatorType
    
    # Sample filter: close > 10 AND RSI between 30 and 70
    sample_request = ScreenerRequest(
        filter_groups=[
            FilterGroup(
                id="main_group",
                logical_operator=LogicalOperator.AND,
                rules=[
                    FilterRule(
                        id="price_filter",
                        left_operand=FilterOperand(
                            type="field",
                            value="close",
                            field_type="number"
                        ),
                        operator=OperatorType.GREATER_THAN,
                        right_operand=FilterOperand(
                            type="constant",
                            value=10.0
                        ),
                        enabled=True
                    ),
                    FilterRule(
                        id="rsi_filter",
                        left_operand=FilterOperand(
                            type="field", 
                            value="RSI",
                            field_type="number"
                        ),
                        operator=OperatorType.BETWEEN,
                        right_operand=FilterOperand(
                            type="constant",
                            value=[30.0, 70.0]
                        ),
                        enabled=True
                    )
                ],
                nested_groups=[],
                enabled=True
            )
        ],
        columns=None,  # Use defaults
        limit=100,
        sort_by="market_cap_basic",
        sort_ascending=False
    )
    
    return sample_request


# Test the serializer
if __name__ == "__main__":
    # Load field metadata
    import json
    with open('static/fields.json', 'r') as f:
        fields_data = json.load(f)
    
    field_metadata = {
        field['Name']: FieldMetadata(**field) 
        for field in fields_data['fields']
    }
    
    # Create serializer
    serializer = FilterSerializer(field_metadata)
    
    # Test with sample request
    sample_request = create_sample_request()
    
    print("🧪 Testing filter serialization...")
    print(f"📋 Sample request: {sample_request.json(indent=2)}")
    
    try:
        # Test TradingView query serialization
        query = serializer.serialize_screener_request(sample_request)
        print(f"✅ TradingView query created successfully")
        
        # Test legacy parameter serialization
        legacy_params = serializer.serialize_to_legacy_params(sample_request)
        print(f"✅ Legacy parameters: {legacy_params}")
        
    except Exception as e:
        print(f"❌ Serialization error: {e}")

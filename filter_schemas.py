"""
Pydantic schemas for dynamic filter validation and serialization
"""
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Union, Any, Dict
from enum import Enum


class OperatorType(str, Enum):
    """Supported filter operators based on field types"""
    # Numeric operators
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    GREATER_THAN = "greater_than"
    GREATER_THAN_OR_EQUAL = "greater_than_or_equal"
    LESS_THAN = "less_than"
    LESS_THAN_OR_EQUAL = "less_than_or_equal"
    BETWEEN = "between"
    
    # String/Enum operators
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    IN = "in"
    NOT_IN = "not_in"
    
    # Field comparison operators
    FIELD_EQUALS = "field_equals"
    FIELD_GREATER_THAN = "field_greater_than"
    FIELD_LESS_THAN = "field_less_than"
    
    # Percentage-based field comparison operators
    FIELD_GREATER_THAN_BY_PERCENT = "field_greater_than_by_percent"
    FIELD_LESS_THAN_BY_PERCENT = "field_less_than_by_percent"


class LogicalOperator(str, Enum):
    """Logical operators for combining filter rules"""
    AND = "AND"
    OR = "OR"


class FieldType(str, Enum):
    """Field data types from metadata"""
    NUMBER = "number"
    STRING = "string"
    ENUM = "enum"


class FilterOperand(BaseModel):
    """Represents an operand in a filter rule (field or constant)"""
    type: str = Field(..., description="Type: 'field' or 'constant'")
    value: Union[str, float, int, List[Union[str, float, int]]] = Field(..., description="Field name or constant value")
    field_type: Optional[FieldType] = Field(None, description="Data type if operand is a field")


class FilterRule(BaseModel):
    """Individual filter rule: left_operand operator right_operand"""
    id: str = Field(..., description="Unique identifier for this rule")
    left_operand: FilterOperand = Field(..., description="Left side of the comparison")
    operator: OperatorType = Field(..., description="Comparison operator")
    right_operand: FilterOperand = Field(..., description="Right side of the comparison")
    enabled: bool = Field(True, description="Whether this rule is active")
    
    @validator('operator')
    def validate_operator_compatibility(cls, v, values):
        """Validate that operator is compatible with operand types"""
        # TODO: Add validation logic based on field types
        return v


class FilterGroup(BaseModel):
    """Group of filter rules combined with logical operators"""
    id: str = Field(..., description="Unique identifier for this group")
    logical_operator: LogicalOperator = Field(LogicalOperator.AND, description="How to combine rules in this group")
    rules: List[FilterRule] = Field(default_factory=list, description="Individual filter rules")
    nested_groups: List['FilterGroup'] = Field(default_factory=list, description="Nested filter groups")
    enabled: bool = Field(True, description="Whether this group is active")


# Enable forward references for nested groups
FilterGroup.model_rebuild()


class ScreenerRequest(BaseModel):
    """Complete screener request with filters and options"""
    filter_groups: List[FilterGroup] = Field(..., description="Top-level filter groups")
    columns: Optional[List[str]] = Field(None, description="Columns to return (if None, use defaults)")
    limit: Optional[int] = Field(1000, description="Maximum number of results")
    sort_by: Optional[str] = Field("market_cap_basic", description="Field to sort by")
    sort_ascending: bool = Field(False, description="Sort direction")
    
    class Config:
        schema_extra = {
            "example": {
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
                                "enabled": True
                            }
                        ],
                        "nested_groups": [],
                        "enabled": True
                    }
                ],
                "columns": ["name", "close", "change", "volume"],
                "limit": 100,
                "sort_by": "market_cap_basic",
                "sort_ascending": False
            }
        }


class ScreenerResponse(BaseModel):
    """Response from screener API"""
    success: bool = Field(..., description="Whether the request was successful")
    count: int = Field(..., description="Number of results found")
    data: List[Dict[str, Any]] = Field(..., description="Result data")
    columns: List[str] = Field(..., description="Column names in the data")
    message: Optional[str] = Field(None, description="Success or error message")
    csv_data: Optional[str] = Field(None, description="CSV export data")
    filename: Optional[str] = Field(None, description="Suggested filename for CSV")


class FieldMetadata(BaseModel):
    """Field metadata structure"""
    Name: str = Field(..., description="Internal field name")
    Display_name: str = Field(..., alias="Display name", description="Human-readable field name")
    Type: FieldType = Field(..., description="Field data type")
    Group_Name: str = Field(..., alias="Group Name", description="Field group/category")
    description: Optional[str] = Field(None, description="Field description (TODO)")
    
    class Config:
        allow_population_by_field_name = True


class FieldsMetadata(BaseModel):
    """Complete field metadata structure"""
    fields: List[FieldMetadata] = Field(..., description="All available fields")
    grouped_fields: Dict[str, List[FieldMetadata]] = Field(..., description="Fields grouped by category")
    groups: List[str] = Field(..., description="Available field groups")


# Utility functions for operator validation
def get_operators_for_type(field_type: FieldType) -> List[OperatorType]:
    """Get valid operators for a given field type"""
    if field_type == FieldType.NUMBER:
        return [
            OperatorType.EQUALS,
            OperatorType.NOT_EQUALS,
            OperatorType.GREATER_THAN,
            OperatorType.GREATER_THAN_OR_EQUAL,
            OperatorType.LESS_THAN,
            OperatorType.LESS_THAN_OR_EQUAL,
            OperatorType.BETWEEN,
            OperatorType.FIELD_EQUALS,
            OperatorType.FIELD_GREATER_THAN,
            OperatorType.FIELD_LESS_THAN,
            OperatorType.FIELD_GREATER_THAN_BY_PERCENT,
            OperatorType.FIELD_LESS_THAN_BY_PERCENT,
        ]
    elif field_type == FieldType.STRING:
        return [
            OperatorType.EQUALS,
            OperatorType.NOT_EQUALS,
            OperatorType.CONTAINS,
            OperatorType.NOT_CONTAINS,
            OperatorType.STARTS_WITH,
            OperatorType.ENDS_WITH,
            OperatorType.FIELD_EQUALS,
        ]
    elif field_type == FieldType.ENUM:
        return [
            OperatorType.EQUALS,
            OperatorType.NOT_EQUALS,
            OperatorType.IN,
            OperatorType.NOT_IN,
            OperatorType.FIELD_EQUALS,
        ]
    else:
        return []


def is_field_operator(operator: OperatorType) -> bool:
    """Check if operator requires field as right operand"""
    return operator in [
        OperatorType.FIELD_EQUALS,
        OperatorType.FIELD_GREATER_THAN,
        OperatorType.FIELD_LESS_THAN,
        OperatorType.FIELD_GREATER_THAN_BY_PERCENT,
        OperatorType.FIELD_LESS_THAN_BY_PERCENT,
    ]

def is_percentage_operator(operator: OperatorType) -> bool:
    """Check if operator requires percentage value"""
    return operator in [
        OperatorType.FIELD_GREATER_THAN_BY_PERCENT,
        OperatorType.FIELD_LESS_THAN_BY_PERCENT,
    ]

def validate_filter_rule(rule: FilterRule, field_metadata: Dict[str, FieldMetadata]) -> bool:
    """Validate a filter rule against field metadata"""
    # Check if left operand field exists
    if rule.left_operand.type == "field":
        field_name = rule.left_operand.value
        if field_name not in field_metadata:
            return False
        
        field_type = field_metadata[field_name].Type
        valid_operators = get_operators_for_type(field_type)
        if rule.operator not in valid_operators:
            return False
    
    # Additional validation logic can be added here
    return True

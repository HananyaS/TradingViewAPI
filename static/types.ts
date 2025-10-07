/**
 * TypeScript type definitions for the dynamic filter builder
 */

// Enums matching backend schemas
export enum OperatorType {
  // Numeric operators
  EQUALS = "equals",
  NOT_EQUALS = "not_equals", 
  GREATER_THAN = "greater_than",
  GREATER_THAN_OR_EQUAL = "greater_than_or_equal",
  LESS_THAN = "less_than",
  LESS_THAN_OR_EQUAL = "less_than_or_equal",
  BETWEEN = "between",
  
  // String/Enum operators
  CONTAINS = "contains",
  NOT_CONTAINS = "not_contains",
  STARTS_WITH = "starts_with",
  ENDS_WITH = "ends_with",
  IN = "in",
  NOT_IN = "not_in",
  
  // Field comparison operators
  FIELD_EQUALS = "field_equals",
  FIELD_GREATER_THAN = "field_greater_than",
  FIELD_LESS_THAN = "field_less_than",
  
  // Percentage-based field comparison operators
  FIELD_GREATER_THAN_BY_PERCENT = "field_greater_than_by_percent",
  FIELD_LESS_THAN_BY_PERCENT = "field_less_than_by_percent"
}

export enum LogicalOperator {
  AND = "AND",
  OR = "OR"
}

export enum FieldType {
  NUMBER = "number",
  STRING = "string", 
  ENUM = "enum"
}

// Core data structures
export interface FieldMetadata {
  Name: string;
  "Display name": string;
  Type: FieldType;
  "Group Name": string;
  description?: string; // TODO: to be added later
}

export interface FieldsMetadata {
  fields: FieldMetadata[];
  grouped_fields: Record<string, FieldMetadata[]>;
  groups: string[];
}

export interface FilterOperand {
  type: "field" | "constant";
  value: string | number | (string | number)[];
  field_type?: FieldType;
}

export interface FilterRule {
  id: string;
  left_operand: FilterOperand;
  operator: OperatorType;
  right_operand: FilterOperand;
  enabled: boolean;
}

export interface FilterGroup {
  id: string;
  logical_operator: LogicalOperator;
  rules: FilterRule[];
  nested_groups: FilterGroup[];
  enabled: boolean;
}

export interface ScreenerRequest {
  filter_groups: FilterGroup[];
  columns?: string[];
  limit?: number;
  sort_by?: string;
  sort_ascending?: boolean;
}

export interface ScreenerResponse {
  success: boolean;
  count: number;
  data: Record<string, any>[];
  columns: string[];
  message?: string;
  csv_data?: string;
  filename?: string;
}

// UI-specific types
export interface OperatorOption {
  value: OperatorType;
  label: string;
  description: string;
}

export interface FieldOption {
  value: string;
  label: string;
  type: FieldType;
  group: string;
}

// Filter builder state
export interface FilterBuilderState {
  fieldMetadata: FieldsMetadata | null;
  filterGroups: FilterGroup[];
  isLoading: boolean;
  error: string | null;
}

// Utility functions for operators
export const getOperatorsForType = (fieldType: FieldType): OperatorOption[] => {
  const baseOperators: OperatorOption[] = [
    { value: OperatorType.EQUALS, label: "equals", description: "Equal to" },
    { value: OperatorType.NOT_EQUALS, label: "≠", description: "Not equal to" }
  ];

  if (fieldType === FieldType.NUMBER) {
    return [
      ...baseOperators,
      { value: OperatorType.GREATER_THAN, label: ">", description: "Greater than" },
      { value: OperatorType.GREATER_THAN_OR_EQUAL, label: "≥", description: "Greater than or equal" },
      { value: OperatorType.LESS_THAN, label: "<", description: "Less than" },
      { value: OperatorType.LESS_THAN_OR_EQUAL, label: "≤", description: "Less than or equal" },
      { value: OperatorType.BETWEEN, label: "between", description: "Between two values" },
      { value: OperatorType.FIELD_EQUALS, label: "= field", description: "Equal to another field" },
      { value: OperatorType.FIELD_GREATER_THAN, label: "> field", description: "Greater than another field" },
      { value: OperatorType.FIELD_LESS_THAN, label: "< field", description: "Less than another field" },
      { value: OperatorType.FIELD_GREATER_THAN_BY_PERCENT, label: "> field by %", description: "Greater than another field by percentage" },
      { value: OperatorType.FIELD_LESS_THAN_BY_PERCENT, label: "< field by %", description: "Less than another field by percentage" }
    ];
  } else if (fieldType === FieldType.STRING) {
    return [
      ...baseOperators,
      { value: OperatorType.CONTAINS, label: "contains", description: "Contains text" },
      { value: OperatorType.NOT_CONTAINS, label: "not contains", description: "Does not contain text" },
      { value: OperatorType.STARTS_WITH, label: "starts with", description: "Starts with text" },
      { value: OperatorType.ENDS_WITH, label: "ends with", description: "Ends with text" },
      { value: OperatorType.FIELD_EQUALS, label: "= field", description: "Equal to another field" }
    ];
  } else if (fieldType === FieldType.ENUM) {
    return [
      ...baseOperators,
      { value: OperatorType.IN, label: "in", description: "In list of values" },
      { value: OperatorType.NOT_IN, label: "not in", description: "Not in list of values" },
      { value: OperatorType.FIELD_EQUALS, label: "= field", description: "Equal to another field" }
    ];
  }

  return baseOperators;
};

// Validation functions
export const isFieldOperator = (operator: OperatorType): boolean => {
  return [
    OperatorType.FIELD_EQUALS,
    OperatorType.FIELD_GREATER_THAN,
    OperatorType.FIELD_LESS_THAN,
    OperatorType.FIELD_GREATER_THAN_BY_PERCENT,
    OperatorType.FIELD_LESS_THAN_BY_PERCENT
  ].includes(operator);
};

export const isPercentageOperator = (operator: OperatorType): boolean => {
  return [
    OperatorType.FIELD_GREATER_THAN_BY_PERCENT,
    OperatorType.FIELD_LESS_THAN_BY_PERCENT
  ].includes(operator);
};

export const requiresArrayValue = (operator: OperatorType): boolean => {
  return [
    OperatorType.BETWEEN,
    OperatorType.IN,
    OperatorType.NOT_IN
  ].includes(operator);
};

// Helper functions for creating new instances
export const createEmptyFilterRule = (): FilterRule => ({
  id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  left_operand: {
    type: "field",
    value: "",
    field_type: FieldType.NUMBER
  },
  operator: OperatorType.EQUALS,
  right_operand: {
    type: "constant",
    value: ""
  },
  enabled: true
});

export const createEmptyFilterGroup = (): FilterGroup => ({
  id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  logical_operator: LogicalOperator.AND,
  rules: [createEmptyFilterRule()],
  nested_groups: [],
  enabled: true
});

export const createEmptyScreenerRequest = (): ScreenerRequest => ({
  filter_groups: [createEmptyFilterGroup()],
  columns: undefined,
  limit: 100,
  sort_by: "market_cap_basic",
  sort_ascending: false
});

// Validation helpers
export const validateFilterRule = (rule: FilterRule, fieldMetadata: FieldsMetadata): string[] => {
  const errors: string[] = [];
  
  // Check if left operand field exists
  if (rule.left_operand.type === "field") {
    const fieldExists = fieldMetadata.fields.some(f => f.Name === rule.left_operand.value);
    if (!fieldExists) {
      errors.push(`Field '${rule.left_operand.value}' does not exist`);
    }
  }
  
  // Check if right operand is valid for field operators
  if (isFieldOperator(rule.operator) && rule.right_operand.type !== "field") {
    errors.push(`Operator '${rule.operator}' requires a field as right operand`);
  }
  
  // Check if array value is provided for operators that require it
  if (requiresArrayValue(rule.operator) && !Array.isArray(rule.right_operand.value)) {
    errors.push(`Operator '${rule.operator}' requires an array value`);
  }
  
  return errors;
};

export const validateFilterGroup = (group: FilterGroup, fieldMetadata: FieldsMetadata): string[] => {
  const errors: string[] = [];
  
  // Validate all rules
  for (const rule of group.rules) {
    const ruleErrors = validateFilterRule(rule, fieldMetadata);
    errors.push(...ruleErrors);
  }
  
  // Validate nested groups recursively
  for (const nestedGroup of group.nested_groups) {
    const nestedErrors = validateFilterGroup(nestedGroup, fieldMetadata);
    errors.push(...nestedErrors);
  }
  
  return errors;
};

export const validateScreenerRequest = (request: ScreenerRequest, fieldMetadata: FieldsMetadata): string[] => {
  const errors: string[] = [];
  
  // Validate all filter groups
  for (const group of request.filter_groups) {
    const groupErrors = validateFilterGroup(group, fieldMetadata);
    errors.push(...groupErrors);
  }
  
  // Validate columns if specified
  if (request.columns) {
    for (const column of request.columns) {
      const fieldExists = fieldMetadata.fields.some(f => f.Name === column);
      if (!fieldExists) {
        errors.push(`Column '${column}' does not exist`);
      }
    }
  }
  
  return errors;
};

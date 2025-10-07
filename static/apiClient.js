/**
 * API client for the dynamic filter builder
 */

class ScreenerAPI {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
  }

  /**
   * Fetch field metadata for the filter builder
   */
  async getFieldsMetadata() {
    try {
      console.log('🔍 Fetching field metadata from /api/fields...');
      const response = await fetch(`${this.baseURL}/api/fields`);
      console.log('📡 Response received:', response.status, response.statusText);
      
      const result = await response.json();
      console.log('📋 Response data:', result);
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}: Failed to fetch field metadata`);
      }
      
      if (!result.success) {
        throw new Error(result.error || 'API returned success: false');
      }
      
      if (!result.data || !result.data.fields) {
        throw new Error('Invalid response format: missing fields data');
      }
      
      console.log(`✅ Loaded ${result.data.fields.length} fields in ${result.data.groups.length} groups`);
      return result.data;
    } catch (error) {
      console.error('❌ Error fetching field metadata:', error);
      throw error;
    }
  }

  /**
   * Submit a dynamic screener request
   */
  async submitScreenerRequest(screenerRequest) {
    try {
      console.log('🚀 Submitting screener request:', screenerRequest);
      
      const response = await fetch(`${this.baseURL}/api/screener`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(screenerRequest)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Screener request failed');
      }
      
      console.log('✅ Screener request successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Error submitting screener request:', error);
      throw error;
    }
  }

  /**
   * Submit legacy screener request (for backward compatibility)
   */
  async submitLegacyQuery(params) {
    try {
      const response = await fetch(`${this.baseURL}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Query failed');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error submitting legacy query:', error);
      throw error;
    }
  }

  /**
   * Download CSV results
   */
  async downloadCSV(csvData, filename) {
    try {
      const response = await fetch(`${this.baseURL}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csv_data: csvData,
          filename: filename
        })
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('❌ Error downloading CSV:', error);
      throw error;
    }
  }
}

// Utility functions for working with filter data
const FilterUtils = {
  /**
   * Create a new empty filter rule
   */
  createEmptyRule() {
    return {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      left_operand: {
        type: "field",
        value: "",
        field_type: "number"
      },
      operator: "equals",
      right_operand: {
        type: "constant",
        value: ""
      },
      enabled: true
    };
  },

  /**
   * Create a new empty filter group
   */
  createEmptyGroup() {
    return {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      logical_operator: "AND",
      rules: [this.createEmptyRule()],
      nested_groups: [],
      enabled: true
    };
  },

  /**
   * Get operators for a field type
   */
  getOperatorsForType(fieldType) {
    const baseOperators = [
      { value: "equals", label: "=", description: "Equal to" },
      { value: "not_equals", label: "≠", description: "Not equal to" }
    ];

    if (fieldType === "number") {
      return [
        ...baseOperators,
        { value: "greater_than", label: ">", description: "Greater than" },
        { value: "greater_than_or_equal", label: "≥", description: "Greater than or equal" },
        { value: "less_than", label: "<", description: "Less than" },
        { value: "less_than_or_equal", label: "≤", description: "Less than or equal" },
        { value: "between", label: "between", description: "Between two values" },
        { value: "field_equals", label: "= field", description: "Equal to another field" },
        { value: "field_greater_than", label: "> field", description: "Greater than another field" },
        { value: "field_less_than", label: "< field", description: "Less than another field" },
        { value: "field_greater_than_by_percent", label: "> field by %", description: "Greater than another field by percentage" },
        { value: "field_less_than_by_percent", label: "< field by %", description: "Less than another field by percentage" }
      ];
    } else if (fieldType === "string") {
      return [
        ...baseOperators,
        { value: "contains", label: "contains", description: "Contains text" },
        { value: "not_contains", label: "not contains", description: "Does not contain text" },
        { value: "starts_with", label: "starts with", description: "Starts with text" },
        { value: "ends_with", label: "ends with", description: "Ends with text" },
        { value: "field_equals", label: "= field", description: "Equal to another field" }
      ];
    } else if (fieldType === "enum") {
      return [
        ...baseOperators,
        { value: "in", label: "in", description: "In list of values" },
        { value: "not_in", label: "not in", description: "Not in list of values" },
        { value: "field_equals", label: "= field", description: "Equal to another field" }
      ];
    }

    return baseOperators;
  },

  /**
   * Check if operator requires field as right operand
   */
  isFieldOperator(operator) {
    return ["field_equals", "field_greater_than", "field_less_than", "field_greater_than_by_percent", "field_less_than_by_percent"].includes(operator);
  },

  /**
   * Check if operator requires percentage value
   */
  isPercentageOperator(operator) {
    return ["field_greater_than_by_percent", "field_less_than_by_percent"].includes(operator);
  },

  /**
   * Check if operator requires array value
   */
  requiresArrayValue(operator) {
    return ["between", "in", "not_in"].includes(operator);
  },

  /**
   * Validate a filter rule
   */
  validateRule(rule, fieldMetadata) {
    const errors = [];
    
    // Check if left operand field exists
    if (rule.left_operand.type === "field") {
      const fieldExists = fieldMetadata.fields.some(f => f.Name === rule.left_operand.value);
      if (!fieldExists) {
        errors.push(`Field '${rule.left_operand.value}' does not exist`);
      }
    }
    
    // Check if right operand is valid for field operators
    if (this.isFieldOperator(rule.operator) && rule.right_operand.type !== "field") {
      errors.push(`Operator '${rule.operator}' requires a field as right operand`);
    }
    
    // Check if array value is provided for operators that require it
    if (this.requiresArrayValue(rule.operator) && !Array.isArray(rule.right_operand.value)) {
      errors.push(`Operator '${rule.operator}' requires an array value`);
    }
    
    return errors;
  },

  /**
   * Convert filter groups to a simple description string
   */
  describeFilters(filterGroups, fieldMetadata) {
    if (!filterGroups || filterGroups.length === 0) {
      return "No filters";
    }

    const describeGroup = (group) => {
      const ruleDescriptions = group.rules
        .filter(rule => rule.enabled)
        .map(rule => {
          const leftField = fieldMetadata.fields.find(f => f.Name === rule.left_operand.value);
          const leftName = leftField ? leftField["Display name"] : rule.left_operand.value;
          
          let rightValue = rule.right_operand.value;
          if (rule.right_operand.type === "field") {
            const rightField = fieldMetadata.fields.find(f => f.Name === rule.right_operand.value);
            rightValue = rightField ? rightField["Display name"] : rule.right_operand.value;
          }
          
          return `${leftName} ${rule.operator} ${rightValue}`;
        });

      const nestedDescriptions = group.nested_groups
        .filter(nested => nested.enabled)
        .map(nested => `(${describeGroup(nested)})`);

      const allDescriptions = [...ruleDescriptions, ...nestedDescriptions];
      return allDescriptions.join(` ${group.logical_operator} `);
    };

    return filterGroups
      .filter(group => group.enabled)
      .map(group => describeGroup(group))
      .join(" AND ");
  }
};

// Export for use in modules or global scope
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ScreenerAPI, FilterUtils };
} else {
  window.ScreenerAPI = ScreenerAPI;
  window.FilterUtils = FilterUtils;
}

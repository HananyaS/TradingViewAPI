import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

const FilterBuilder = ({ filters, onChange, theme }) => {
  const [fieldMetadata, setFieldMetadata] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFieldMetadata();
  }, []);

  const loadFieldMetadata = async () => {
    try {
      const response = await fetch('/api/fields');
      const data = await response.json();
      
      if (data.success) {
        setFieldMetadata(data.data);
      }
    } catch (error) {
      console.error('Error loading field metadata:', error);
    } finally {
      setLoading(false);
    }
  };

  const createEmptyGroup = () => ({
    id: `group_${Date.now()}`,
    logical_operator: 'AND',
    rules: [createEmptyRule()],
    nested_groups: [],
    enabled: true
  });

  const createEmptyRule = () => ({
    id: `rule_${Date.now()}`,
    left_operand: { type: 'field', value: '' },
    operator: 'greater_than',
    right_operand: { type: 'constant', value: '' },
    enabled: true
  });

  const addGroup = () => {
    onChange([...filters, createEmptyGroup()]);
  };

  const removeGroup = (groupIndex) => {
    const newFilters = filters.filter((_, index) => index !== groupIndex);
    onChange(newFilters.length ? newFilters : [createEmptyGroup()]);
  };

  const updateGroup = (groupIndex, updates) => {
    const newFilters = [...filters];
    newFilters[groupIndex] = { ...newFilters[groupIndex], ...updates };
    onChange(newFilters);
  };

  const addRule = (groupIndex) => {
    const newFilters = [...filters];
    newFilters[groupIndex].rules.push(createEmptyRule());
    onChange(newFilters);
  };

  const removeRule = (groupIndex, ruleIndex) => {
    const newFilters = [...filters];
    newFilters[groupIndex].rules = newFilters[groupIndex].rules.filter((_, index) => index !== ruleIndex);
    
    if (newFilters[groupIndex].rules.length === 0) {
      newFilters[groupIndex].rules = [createEmptyRule()];
    }
    
    onChange(newFilters);
  };

  const updateRule = (groupIndex, ruleIndex, updates) => {
    const newFilters = [...filters];
    newFilters[groupIndex].rules[ruleIndex] = { 
      ...newFilters[groupIndex].rules[ruleIndex], 
      ...updates 
    };
    onChange(newFilters);
  };

  const getOperatorsForType = (fieldType) => {
    const baseOperators = [
      { value: 'equals', label: '=', description: 'Equal to' },
      { value: 'not_equals', label: '≠', description: 'Not equal to' }
    ];

    if (fieldType === 'number') {
      return [
        ...baseOperators,
        { value: 'greater_than', label: '>', description: 'Greater than' },
        { value: 'greater_than_or_equal', label: '≥', description: 'Greater than or equal' },
        { value: 'less_than', label: '<', description: 'Less than' },
        { value: 'less_than_or_equal', label: '≤', description: 'Less than or equal' },
        { value: 'between', label: 'between', description: 'Between two values' },
        { value: 'field_greater_than', label: '> field', description: 'Greater than another field' },
        { value: 'field_less_than', label: '< field', description: 'Less than another field' },
        { value: 'field_greater_than_by_percent', label: '> field by %', description: 'Greater than field by percentage' }
      ];
    }

    return baseOperators;
  };

  const renderFieldSelect = (value, onChange) => {
    if (!fieldMetadata) return null;

    return (
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            theme === 'dark' 
              ? 'bg-gray-700 border-gray-600 text-white' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          <option value="">Select field...</option>
          {fieldMetadata.groups.map(groupName => (
            <optgroup key={groupName} label={groupName}>
              {fieldMetadata.grouped_fields[groupName]?.map(field => (
                <option key={field.Name} value={field.Name}>
                  {field['Display name'] || field.Name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
    );
  };

  const renderOperatorSelect = (fieldType, value, onChange) => {
    const operators = getOperatorsForType(fieldType);

    return (
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            theme === 'dark' 
              ? 'bg-gray-700 border-gray-600 text-white' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          {operators.map(op => (
            <option key={op.value} value={op.value} title={op.description}>
              {op.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
    );
  };

  const renderValueInput = (operator, value, onChange, fieldType = 'number') => {
    if (operator === 'between') {
      const arrayValue = Array.isArray(value) ? value : ['', ''];
      return (
        <div className="flex space-x-2">
          <input
            type="number"
            value={arrayValue[0]}
            onChange={(e) => onChange([e.target.value, arrayValue[1]])}
            placeholder="Min"
            className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              theme === 'dark' 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
          <input
            type="number"
            value={arrayValue[1]}
            onChange={(e) => onChange([arrayValue[0], e.target.value])}
            placeholder="Max"
            className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              theme === 'dark' 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
      );
    }

    if (operator.includes('field')) {
      return renderFieldSelect(value, onChange);
    }

    const inputType = fieldType === 'number' ? 'number' : 'text';
    return (
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${fieldType}...`}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          theme === 'dark' 
            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
        }`}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className={`ml-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
          Loading filter builder...
        </span>
      </div>
    );
  }

  if (!filters.length) {
    onChange([createEmptyGroup()]);
    return null;
  }

  return (
    <div className="space-y-6">
      {filters.map((group, groupIndex) => (
        <div
          key={group.id}
          className={`border rounded-lg p-4 ${
            theme === 'dark' 
              ? 'border-gray-600 bg-gray-750' 
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          {/* Group Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Group {groupIndex + 1}
              </span>
              <select
                value={group.logical_operator}
                onChange={(e) => updateGroup(groupIndex, { logical_operator: e.target.value })}
                className={`px-2 py-1 text-sm border rounded ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => addRule(groupIndex)}
                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors duration-200"
                title="Add Rule"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
              {filters.length > 1 && (
                <button
                  onClick={() => removeGroup(groupIndex)}
                  className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200"
                  title="Remove Group"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Rules */}
          <div className="space-y-3">
            {group.rules.map((rule, ruleIndex) => {
              const field = fieldMetadata?.fields.find(f => f.Name === rule.left_operand.value);
              const fieldType = field?.Type || 'number';

              return (
                <div
                  key={rule.id}
                  className={`grid grid-cols-12 gap-3 items-center p-3 rounded-lg ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border border-gray-700' 
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  {/* Enable/Disable */}
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => updateRule(groupIndex, ruleIndex, { enabled: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>

                  {/* Left Operand (Field) */}
                  <div className="col-span-4">
                    {renderFieldSelect(
                      rule.left_operand.value,
                      (value) => updateRule(groupIndex, ruleIndex, {
                        left_operand: { type: 'field', value }
                      })
                    )}
                  </div>

                  {/* Operator */}
                  <div className="col-span-2">
                    {renderOperatorSelect(
                      fieldType,
                      rule.operator,
                      (operator) => updateRule(groupIndex, ruleIndex, { operator })
                    )}
                  </div>

                  {/* Right Operand (Value) */}
                  <div className="col-span-4">
                    {renderValueInput(
                      rule.operator,
                      rule.right_operand.value,
                      (value) => updateRule(groupIndex, ruleIndex, {
                        right_operand: { type: 'constant', value }
                      }),
                      fieldType
                    )}
                  </div>

                  {/* Remove Rule */}
                  <div className="col-span-1">
                    <button
                      onClick={() => removeRule(groupIndex, ruleIndex)}
                      className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200"
                      title="Remove Rule"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add Group Button */}
      <div className="flex justify-center">
        <button
          onClick={addGroup}
          className={`px-4 py-2 text-sm font-medium border-2 border-dashed rounded-lg transition-colors duration-200 ${
            theme === 'dark'
              ? 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-700'
          }`}
        >
          <PlusIcon className="h-4 w-4 inline mr-2" />
          Add Filter Group
        </button>
      </div>
    </div>
  );
};

export default FilterBuilder;

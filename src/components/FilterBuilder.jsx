import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  ChevronDownIcon,
  FunnelIcon,
  XMarkIcon,
  CheckIcon,
  SparklesIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { getFieldConfig, getOperatorOptions, getDefaultOperator, getEnumValues, isBooleanField } from '../utils/fieldDictionary';

const FilterBuilder = ({ filters, onChange, theme }) => {
  const [fieldMetadata, setFieldMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  useEffect(() => {
    loadFieldMetadata();
    // Expand first group by default
    if (filters.length > 0) {
      setExpandedGroups(new Set([filters[0].id]));
    }
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
    const newGroup = createEmptyGroup();
    onChange([...filters, newGroup]);
    setExpandedGroups(new Set([...expandedGroups, newGroup.id]));
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

  const toggleGroup = (groupId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const renderFieldSelect = (value, onChange, placeholder = 'Select field...') => {
    if (!fieldMetadata) return null;

    const groupedFields = fieldMetadata.grouped_fields || {};

    return (
      <div className="relative group" onClick={(e) => e.stopPropagation()}>
        <select
          value={value || ''}
          onChange={(e) => {
            e.stopPropagation();
            const newValue = e.target.value;
            console.log('[FieldSelect] onChange triggered:', newValue);
            onChange(newValue);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.stopPropagation()}
          className={`w-full pl-4 pr-10 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 appearance-none cursor-pointer ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500' 
              : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400 shadow-sm hover:shadow-md'
          }`}
          style={{
            backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
            paddingRight: '2.5rem',
            zIndex: 10
          }}
        >
          <option 
            value=""
            className={theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
          >
            {placeholder}
          </option>
          {(fieldMetadata.groups || []).map(groupName => (
            <optgroup 
              key={groupName} 
              label={groupName}
              className={theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'}
            >
              {groupedFields[groupName]?.map(field => (
                <option 
                  key={field.Name} 
                  value={field.Name}
                  className={theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
                >
                  {field['Display name'] || field.Name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none z-0" />
      </div>
    );
  };

  const renderOperatorSelect = (fieldType, value, onChange) => {
    const operators = getOperatorOptions(fieldType);

    return (
      <div 
        onClick={(e) => e.stopPropagation()} 
        onMouseDown={(e) => e.stopPropagation()}
        style={{ position: 'relative', zIndex: 10 }}
      >
        <select
          value={value || ''}
          onChange={(e) => {
            e.stopPropagation();
            const newValue = e.target.value;
            console.log('[OperatorSelect] onChange triggered:', newValue);
            onChange(newValue);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onFocus={(e) => {
            e.stopPropagation();
          }}
          className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-600 text-white' 
              : 'bg-white border-gray-300 text-gray-900 shadow-sm'
          }`}
          style={{
            backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
            zIndex: 10,
            position: 'relative'
          }}
        >
          {operators.map(op => (
            <option 
              key={op.value} 
              value={op.value} 
              title={op.description}
              className={theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
            >
              {op.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderValueInput = (rule, field, onChange) => {
    const operator = rule.operator;
    const value = rule.right_operand.value;
    const fieldType = field?.Type || 'number';
    const fieldName = field?.Name || '';
    const config = getFieldConfig(fieldName, fieldType);

    const handleValueChange = (newValue, operandType = 'constant') => {
      onChange({
        type: operandType,
        value: newValue
      });
    };

    const isFieldOperator = [
      'field_equals',
      'field_greater_than',
      'field_less_than',
      'field_greater_than_by_percent',
      'field_less_than_by_percent'
    ].includes(operator);

    if (isFieldOperator) {
      return renderFieldSelect(
        value,
        (selectedField) => handleValueChange(selectedField, 'field'),
        'Select comparison field...'
      );
    }

    // Boolean fields - use toggle switch
    if (config.inputType === 'boolean' || isBooleanField(fieldName, fieldType)) {
      const boolValue = value === true || value === 1 || value === '1' || value === 'true';
      return (
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => handleValueChange(boolValue ? 0 : 1)}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              boolValue 
                ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
                boolValue ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            {config.placeholder || 'Enabled'}
          </span>
        </div>
      );
    }

    // Enum fields - always use dropdown
    if (fieldType === 'enum' || config.inputType === 'enum') {
      const enumOptions = config.options || getEnumValues(fieldName) || [];
      // Only use multi-select if operator is 'in' or 'not_in', regardless of config.multi
      const isMulti = ['in', 'not_in'].includes(operator);
      const currentValue = isMulti 
        ? (Array.isArray(value) ? value : (value ? [value] : []))
        : (value || '');
      
      if (enumOptions.length > 0) {
        return (
          <div 
            onClick={(e) => e.stopPropagation()} 
            onMouseDown={(e) => e.stopPropagation()}
            style={{ position: 'relative', zIndex: 10 }}
          >
            <select
              multiple={isMulti}
              value={currentValue}
              onChange={(e) => {
                e.stopPropagation();
                const target = e.target;
                if (isMulti) {
                  const selections = Array.from(target.selectedOptions, opt => opt.value);
                  console.log('[EnumSelect] onChange (multi):', selections, 'for field:', fieldName);
                  handleValueChange(selections);
                } else {
                  const newValue = target.value;
                  console.log('[EnumSelect] onChange (single):', newValue, 'for field:', fieldName, 'current value was:', value);
                  handleValueChange(newValue);
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onFocus={(e) => {
                e.stopPropagation();
              }}
              size={isMulti ? Math.min(enumOptions.length + 1, 5) : 1}
              className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900 shadow-sm'
              }`}
              style={{
                backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                zIndex: 10,
                position: 'relative'
              }}
            >
            {!isMulti && (
              <option 
                value=""
                className={theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}
              >
                {config.placeholder || 'Select value...'}
              </option>
            )}
            {enumOptions.map(option => (
              <option 
                key={option} 
                value={option}
                className={theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
              >
                {option}
              </option>
            ))}
            </select>
          </div>
        );
      }
    }

    // Between operator - two inputs
    if (operator === 'between') {
      const arrayValue = Array.isArray(value) ? value : ['', ''];
      return (
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <input
              type="number"
              value={arrayValue[0]}
              onChange={(e) => handleValueChange([e.target.value, arrayValue[1]])}
              placeholder="Min"
              step={config.step || 0.01}
              min={config.min}
              max={config.max}
              className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                theme === 'dark' 
                  ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md'
              }`}
            />
          </div>
          <div className="flex items-center">
            <span className={`text-gray-400 font-medium ${theme === 'dark' ? 'text-gray-500' : ''}`}>and</span>
          </div>
          <div className="flex-1 relative">
            <input
              type="number"
              value={arrayValue[1]}
              onChange={(e) => handleValueChange([arrayValue[0], e.target.value])}
              placeholder="Max"
              step={config.step || 0.01}
              min={config.min}
              max={config.max}
              className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                theme === 'dark' 
                  ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md'
              }`}
            />
          </div>
        </div>
      );
    }

    // Multi-select for 'in' and 'not_in' operators
    if (['in', 'not_in'].includes(operator)) {
      const enumOptions = config.options || getEnumValues(fieldName) || [];
      const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

      if (enumOptions.length > 0) {
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <select
              multiple
              value={selectedValues}
              onChange={(e) => {
                e.stopPropagation();
                const selections = Array.from(e.target.selectedOptions).map(opt => opt.value);
                console.log('[MultiSelect] onChange:', selections);
                handleValueChange(selections);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              size={Math.min(enumOptions.length + 1, 5)}
              className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900 shadow-sm'
              }`}
              style={{
                backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                zIndex: 10
              }}
            >
            {enumOptions.map(option => (
              <option 
                key={option} 
                value={option}
                className={theme === 'dark' ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50'}
              >
                {option}
              </option>
            ))}
          </select>
          </div>
        );
      }
    }

    // Numeric fields with slider option
    const inputType = fieldType === 'number' || config.inputType === 'currency' || config.inputType === 'percent'
      ? 'number'
      : 'text';
    const inputValue = value ?? '';
    const hasSlider = config.useSlider && config.min !== undefined && config.max !== undefined;
    const numValue = inputType === 'number' ? (parseFloat(inputValue) || config.min || 0) : inputValue;

    const extraPadding = [
      config.inputType === 'currency' ? 'pl-8' : '',
      config.inputType === 'percent' ? 'pr-8' : ''
    ].join(' ').trim();

    return (
      <div className="space-y-3">
        {hasSlider && (
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {config.min}
              </span>
              <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
                theme === 'dark' 
                  ? 'bg-blue-900/30 text-blue-400' 
                  : 'bg-blue-50 text-blue-600'
              }`}>
                {numValue}{config.inputType === 'percent' ? '%' : ''}
              </span>
              <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {config.max}
              </span>
            </div>
            <input
              type="range"
              min={config.min}
              max={config.max}
              step={config.step || 1}
              value={numValue}
              onChange={(e) => handleValueChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((numValue - config.min) / (config.max - config.min)) * 100}%, ${theme === 'dark' ? '#374151' : '#e5e7eb'} ${((numValue - config.min) / (config.max - config.min)) * 100}%, ${theme === 'dark' ? '#374151' : '#e5e7eb'} 100%)`
              }}
            />
          </div>
        )}
        <div className="relative">
          <input
            type={inputType}
            value={inputValue}
            onChange={(e) => {
              const newValue = inputType === 'number' ? parseFloat(e.target.value) || '' : e.target.value;
              handleValueChange(newValue);
            }}
            placeholder={config.placeholder || `Enter ${fieldType}...`}
            step={config.step || (inputType === 'number' ? 0.01 : undefined)}
            min={config.min}
            max={config.max}
            className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${extraPadding} ${
              theme === 'dark' 
                ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md'
            }`}
          />
          {config.inputType === 'percent' && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">%</span>
          )}
          {config.inputType === 'currency' && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">$</span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          <SparklesIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-blue-600 animate-pulse" />
        </div>
        <span className={`mt-4 text-lg font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
          Loading strategy builder...
        </span>
      </div>
    );
  }

  if (!filters.length) {
    onChange([createEmptyGroup()]);
    return null;
  }

  const totalRules = filters.reduce((sum, group) => sum + group.rules.length, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Stats */}
      <div className={`flex items-center justify-between p-4 rounded-2xl ${
        theme === 'dark' 
          ? 'bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700' 
          : 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100'
      }`}>
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-xl ${
            theme === 'dark' 
              ? 'bg-blue-900/30' 
              : 'bg-white shadow-md'
          }`}>
            <AdjustmentsHorizontalIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Strategy Builder
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {filters.length} group{filters.length !== 1 ? 's' : ''} • {totalRules} rule{totalRules !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Strategy Groups */}
      {filters.map((group, groupIndex) => {
        const isExpanded = expandedGroups.has(group.id);
        const isEnabled = group.enabled !== false;
        
        return (
          <div
            key={group.id}
            className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
              theme === 'dark'
                ? isEnabled
                  ? 'bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700 shadow-xl shadow-gray-900/50'
                  : 'bg-gray-900/50 border-gray-800 opacity-60'
                : isEnabled
                  ? 'bg-white border-gray-200 shadow-lg shadow-gray-100'
                  : 'bg-gray-50 border-gray-300 opacity-60'
            }`}
          >
            {/* Group Header */}
            <div 
              className={`flex items-center justify-between p-5 cursor-pointer transition-all duration-200 ${
                theme === 'dark' 
                  ? 'hover:bg-gray-800/50' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => toggleGroup(group.id)}
            >
              <div className="flex items-center space-x-4 flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-900/50'
                    : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md'
                }`}>
                  {groupIndex + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Strategy Group {groupIndex + 1}
                    </h4>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      group.logical_operator === 'AND'
                        ? theme === 'dark'
                          ? 'bg-green-900/30 text-green-400 border border-green-800'
                          : 'bg-green-100 text-green-700 border border-green-200'
                        : theme === 'dark'
                          ? 'bg-orange-900/30 text-orange-400 border border-orange-800'
                          : 'bg-orange-100 text-orange-700 border border-orange-200'
                    }`}>
                      {group.logical_operator}
                    </div>
                  </div>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {group.rules.length} rule{group.rules.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateGroup(groupIndex, { enabled: !isEnabled });
                  }}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    isEnabled
                      ? theme === 'dark'
                        ? 'text-green-400 hover:bg-green-900/20'
                        : 'text-green-600 hover:bg-green-50'
                      : theme === 'dark'
                        ? 'text-gray-600 hover:bg-gray-800'
                        : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title={isEnabled ? 'Disable group' : 'Enable group'}
                >
                  {isEnabled ? (
                    <CheckIcon className="h-5 w-5" />
                  ) : (
                    <XMarkIcon className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addRule(groupIndex);
                  }}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    theme === 'dark'
                      ? 'text-blue-400 hover:bg-blue-900/20'
                      : 'text-blue-600 hover:bg-blue-50'
                  }`}
                  title="Add Rule"
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
                {filters.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGroup(groupIndex);
                    }}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      theme === 'dark'
                        ? 'text-red-400 hover:bg-red-900/20'
                        : 'text-red-600 hover:bg-red-50'
                    }`}
                    title="Remove Group"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(group.id);
                  }}
                  className={`p-2 rounded-lg transition-all duration-200 transform ${
                    isExpanded ? 'rotate-180' : ''
                  } ${
                    theme === 'dark'
                      ? 'text-gray-400 hover:bg-gray-800'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <ChevronDownIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Logical Operator Selector */}
            <div className={`px-5 pb-3 border-b ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center space-x-3">
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Match:
                </span>
                <div className="flex space-x-2">
                  {['AND', 'OR'].map(op => (
                    <button
                      key={op}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateGroup(groupIndex, { logical_operator: op });
                      }}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        group.logical_operator === op
                          ? theme === 'dark'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                            : 'bg-blue-600 text-white shadow-md'
                          : theme === 'dark'
                            ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rules */}
            {isExpanded && (
              <div className="p-5 space-y-4 animate-slide-down">
                {group.rules.map((rule, ruleIndex) => {
                  const field = fieldMetadata?.fields.find(f => f.Name === rule.left_operand.value);
                  const fieldType = field?.Type || 'number';
                  const fieldName = field?.Name || '';
                  const config = getFieldConfig(fieldName, fieldType);
                  const ruleEnabled = rule.enabled !== false;

                  return (
                    <div
                      key={rule.id}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                        theme === 'dark'
                          ? ruleEnabled
                            ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                            : 'bg-gray-900/30 border-gray-800 opacity-50'
                          : ruleEnabled
                            ? 'bg-gray-50 border-gray-200 hover:border-gray-300 shadow-sm'
                            : 'bg-gray-100 border-gray-300 opacity-50'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        {/* Enable/Disable Toggle */}
                        <div className="pt-1">
                          <button
                            onClick={() => updateRule(groupIndex, ruleIndex, { enabled: !ruleEnabled })}
                            className={`p-1.5 rounded-lg transition-all duration-200 ${
                              ruleEnabled
                                ? theme === 'dark'
                                  ? 'text-green-400 hover:bg-green-900/20'
                                  : 'text-green-600 hover:bg-green-50'
                                : theme === 'dark'
                                  ? 'text-gray-600 hover:bg-gray-800'
                                  : 'text-gray-400 hover:bg-gray-100'
                            }`}
                            title={ruleEnabled ? 'Disable rule' : 'Enable rule'}
                          >
                            {ruleEnabled ? (
                              <CheckIcon className="h-5 w-5" />
                            ) : (
                              <XMarkIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>

                      {/* Rule Content */}
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
                        {/* Field Select */}
                        <div className={isBooleanField(fieldName, fieldType) ? "lg:col-span-6 sm:col-span-2" : "lg:col-span-4 sm:col-span-2"}>
                          <label className={`block text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            Field
                          </label>
                            {renderFieldSelect(
                              rule.left_operand?.value || '',
                              (value) => {
                                console.log('[FilterBuilder] Field selected:', value);
                                const selectedField = fieldMetadata?.fields.find(f => f.Name === value);
                                const nextFieldType = selectedField?.Type || 'number';
                                const nextFieldName = selectedField?.Name || '';
                                const nextConfig = getFieldConfig(nextFieldName, nextFieldType);
                                const isNextBoolean = nextConfig.inputType === 'boolean' || isBooleanField(nextFieldName, nextFieldType);
                                updateRule(groupIndex, ruleIndex, {
                                  left_operand: { type: 'field', value, field_type: nextFieldType },
                                  operator: isNextBoolean ? 'equals' : getDefaultOperator(nextFieldType),
                                  right_operand: { type: 'constant', value: '' }
                                });
                              }
                            )}
                          </div>

                        {/* Operator - Hidden for boolean fields */}
                        {!(config.inputType === 'boolean' || isBooleanField(fieldName, fieldType)) && (
                          <div className="lg:col-span-2 sm:col-span-1">
                            <label className={`block text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                              Operator
                            </label>
                              {renderOperatorSelect(
                                fieldType,
                                rule.operator,
                                (operator) => updateRule(groupIndex, ruleIndex, { operator })
                              )}
                            </div>
                          )}

                        {/* Value Input */}
                        <div className={isBooleanField(fieldName, fieldType) ? "lg:col-span-6 sm:col-span-2" : "lg:col-span-5 sm:col-span-1"}>
                          <label className={`block text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            Value
                          </label>
                            {renderValueInput(
                              rule,
                              field,
                              (operand) => {
                                console.log('[FilterBuilder] Value changed:', operand, 'for rule:', ruleIndex);
                                updateRule(groupIndex, ruleIndex, {
                                  right_operand: operand
                                });
                              }
                            )}
                          </div>

                          {/* Remove Button */}
                          <div className="lg:col-span-1 sm:col-span-2 flex items-center justify-start sm:justify-end pt-4 sm:pt-6">
                            <button
                              onClick={() => removeRule(groupIndex, ruleIndex)}
                              className={`p-2 sm:p-2.5 rounded-full transition-colors duration-200 touch-manipulation ${
                                theme === 'dark'
                                  ? 'text-red-400 hover:bg-red-900/20'
                                  : 'text-red-600 hover:bg-red-50'
                              }`}
                              title="Remove Rule"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Group Button */}
      <button
        onClick={addGroup}
        className={`w-full group relative overflow-hidden px-6 py-4 border-2 border-dashed rounded-2xl transition-all duration-300 ${
          theme === 'dark'
            ? 'border-gray-700 bg-gray-900/30 hover:border-blue-600 hover:bg-blue-900/10'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        <div className="flex items-center justify-center space-x-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark'
              ? 'bg-blue-900/30 group-hover:bg-blue-900/50'
              : 'bg-blue-100 group-hover:bg-blue-200'
          } transition-all duration-300`}>
            <PlusIcon className={`h-5 w-5 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`} />
          </div>
          <span className={`text-base font-semibold ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Add Strategy Group
          </span>
        </div>
      </button>
    </div>
  );
};

export default FilterBuilder;

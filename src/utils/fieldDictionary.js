const EXCHANGE_OPTIONS = [
  'NASDAQ',
  'NYSE',
  'NYSE AMERICAN',
  'NYSE ARCA',
  'CBOE',
  'IEX',
  'OTC'
];

const SECTOR_OPTIONS = [
  'Technology',
  'Financial Services',
  'Healthcare',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Energy',
  'Industrials',
  'Materials',
  'Utilities',
  'Real Estate',
  'Communication Services'
];

const COUNTRY_OPTIONS = [
  'United States',
  'Canada',
  'United Kingdom',
  'Germany',
  'France',
  'Japan',
  'China',
  'Australia',
  'India',
  'Brazil'
];

const DEFAULT_FIELD_BEHAVIOR = {
  number: {
    inputType: 'number',
    step: 0.01
  },
  string: {
    inputType: 'text'
  },
  enum: {
    inputType: 'enum'
  }
};

const FIELD_DICTIONARY = {
  market_cap_basic: {
    inputType: 'currency',
    min: 0,
    step: 1000000,
    placeholder: 'Min market cap (USD)'
  },
  close: {
    inputType: 'currency',
    min: 0,
    step: 0.01,
    placeholder: 'Price in USD'
  },
  change: {
    inputType: 'percent',
    min: -50,
    max: 50,
    step: 0.1,
    placeholder: 'Change %'
  },
  gap: {
    inputType: 'percent',
    min: -25,
    max: 25,
    step: 0.1,
    placeholder: 'Gap %'
  },
  relative_volume: {
    inputType: 'number',
    min: 0,
    step: 0.1,
    placeholder: 'Relative volume'
  },
  volume: {
    inputType: 'number',
    min: 0,
    step: 1000,
    placeholder: 'Volume'
  },
  RSI: {
    inputType: 'number',
    min: 0,
    max: 100,
    step: 1,
    placeholder: 'RSI value'
  },
  'RSI[1]': {
    inputType: 'number',
    min: 0,
    max: 100,
    step: 1,
    placeholder: 'Previous RSI value'
  },
  ADR: {
    inputType: 'percent',
    min: 0,
    max: 50,
    step: 0.1,
    placeholder: 'ADR %'
  },
  ATR: {
    inputType: 'number',
    min: 0,
    step: 0.01,
    placeholder: 'ATR value'
  },
  exchange: {
    inputType: 'enum',
    options: EXCHANGE_OPTIONS,
    multi: true,
    placeholder: 'Select exchange'
  },
  sector: {
    inputType: 'enum',
    options: SECTOR_OPTIONS,
    multi: true,
    placeholder: 'Select sector'
  },
  country: {
    inputType: 'enum',
    options: COUNTRY_OPTIONS,
    multi: true,
    placeholder: 'Select country'
  }
};

const stringOperators = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' }
];

const enumOperators = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'in', label: 'is in list' },
  { value: 'not_in', label: 'not in list' }
];

const numberOperators = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '≠' },
  { value: 'greater_than', label: '>' },
  { value: 'greater_than_or_equal', label: '≥' },
  { value: 'less_than', label: '<' },
  { value: 'less_than_or_equal', label: '≤' },
  { value: 'between', label: 'between' },
  { value: 'field_equals', label: '= field' },
  { value: 'field_greater_than', label: '> field' },
  { value: 'field_less_than', label: '< field' },
  { value: 'field_greater_than_by_percent', label: '> field by %' },
  { value: 'field_less_than_by_percent', label: '< field by %' }
];

const DEFAULT_OPERATOR_BY_TYPE = {
  number: 'greater_than',
  string: 'contains',
  enum: 'equals'
};

export const getFieldConfig = (fieldName, fallbackType = 'number') => {
  const dictionaryEntry = FIELD_DICTIONARY[fieldName];
  if (dictionaryEntry) {
    return dictionaryEntry;
  }

  return DEFAULT_FIELD_BEHAVIOR[fallbackType] || DEFAULT_FIELD_BEHAVIOR.number;
};

export const getOperatorOptions = (fieldType) => {
  if (fieldType === 'string') return stringOperators;
  if (fieldType === 'enum') return enumOperators;
  return numberOperators;
};

export const getDefaultOperator = (fieldType) => {
  return DEFAULT_OPERATOR_BY_TYPE[fieldType] || DEFAULT_OPERATOR_BY_TYPE.number;
};



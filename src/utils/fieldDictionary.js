const EXCHANGE_OPTIONS = [
  'NASDAQ',
  'NYSE',
  'NYSE AMERICAN',
  'NYSE ARCA',
  'CBOE',
  'CBOE BZX',
  'CBOE BYX',
  'CBOE EDGX',
  'CBOE EDGA',
  'IEX',
  'OTC',
  'OTC MARKETS',
  'PHILADELPHIA STOCK EXCHANGE',
  'NYSE CHICAGO',
  'NATIONAL STOCK EXCHANGE',
  'NASDAQ BX',
  'BATS',
  'INSTINET'
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
    step: 0.01,
    useSlider: false
  },
  string: {
    inputType: 'text'
  },
  enum: {
    inputType: 'enum'
  },
  boolean: {
    inputType: 'checkbox',
    options: [true, false]
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
  volume: {
    inputType: 'number',
    min: 0,
    step: 1000,
    placeholder: 'Volume'
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
  },
  industry: {
    inputType: 'enum',
    options: [], // Industry values are dynamic - will be populated from API if available
    multi: true,
    placeholder: 'Select industry'
  },
  // Candlestick patterns (boolean fields - 0 or 1)
  'Candle.Hammer': {
    inputType: 'boolean',
    placeholder: 'Has Hammer pattern'
  },
  'Candle.Engulfing.Bullish': {
    inputType: 'boolean',
    placeholder: 'Has Bullish Engulfing pattern'
  },
  'Candle.Engulfing.Bearish': {
    inputType: 'boolean',
    placeholder: 'Has Bearish Engulfing pattern'
  },
  'Candle.Doji': {
    inputType: 'boolean',
    placeholder: 'Has Doji pattern'
  },
  'Candle.Marubozu.White': {
    inputType: 'boolean',
    placeholder: 'Has White Marubozu pattern'
  },
  'Candle.Marubozu.Black': {
    inputType: 'boolean',
    placeholder: 'Has Black Marubozu pattern'
  },
  'Candle.DragonFly.Doji': {
    inputType: 'boolean',
    placeholder: 'Has Dragonfly Doji pattern'
  },
  'Candle.GraveStone.Doji': {
    inputType: 'boolean',
    placeholder: 'Has Gravestone Doji pattern'
  },
  // Enhanced numeric fields with sliders
  RSI: {
    inputType: 'number',
    min: 0,
    max: 100,
    step: 1,
    useSlider: true,
    placeholder: 'RSI value (0-100)'
  },
  'RSI[1]': {
    inputType: 'number',
    min: 0,
    max: 100,
    step: 1,
    useSlider: true,
    placeholder: 'Previous RSI value (0-100)'
  },
  change: {
    inputType: 'percent',
    min: -100,
    max: 100,
    step: 0.1,
    useSlider: true,
    placeholder: 'Change %'
  },
  gap: {
    inputType: 'percent',
    min: -50,
    max: 50,
    step: 0.1,
    useSlider: true,
    placeholder: 'Gap %'
  },
  ADR: {
    inputType: 'percent',
    min: 0,
    max: 50,
    step: 0.1,
    useSlider: true,
    placeholder: 'ADR %'
  },
  relative_volume: {
    inputType: 'number',
    min: 0,
    max: 10,
    step: 0.1,
    useSlider: true,
    placeholder: 'Relative volume'
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

  // Check if it's a candlestick pattern (boolean)
  if (fieldName && fieldName.startsWith('Candle.')) {
    return {
      inputType: 'boolean',
      placeholder: `Has ${fieldName.replace('Candle.', '').replace('.', ' ')} pattern`
    };
  }

  return DEFAULT_FIELD_BEHAVIOR[fallbackType] || DEFAULT_FIELD_BEHAVIOR.number;
};

// Get enum values for a field (if available)
export const getEnumValues = (fieldName) => {
  const config = getFieldConfig(fieldName);
  if (config.inputType === 'enum' && config.options) {
    return config.options;
  }
  return null;
};

// Check if field is boolean
export const isBooleanField = (fieldName, fieldType) => {
  const config = getFieldConfig(fieldName, fieldType);
  return config.inputType === 'boolean' || 
         (fieldName && fieldName.startsWith('Candle.'));
};

export const getOperatorOptions = (fieldType) => {
  if (fieldType === 'string') return stringOperators;
  if (fieldType === 'enum') return enumOperators;
  return numberOperators;
};

export const getDefaultOperator = (fieldType) => {
  return DEFAULT_OPERATOR_BY_TYPE[fieldType] || DEFAULT_OPERATOR_BY_TYPE.number;
};



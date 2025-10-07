/**
 * Dynamic Filter Builder Component (Vanilla JS)
 * 
 * This component provides a UI for building complex filters with:
 * - Searchable field dropdowns grouped by category
 * - Dynamic operator selection based on field type
 * - Field-to-field and field-to-constant comparisons
 * - Nested logical groups (AND/OR)
 * - Real-time validation
 */

class FilterBuilder {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      showPreview: true,
      allowNesting: true,
      maxNestingDepth: 3,
      ...options
    };
    
    this.fieldMetadata = null;
    this.filterGroups = [];
    this.api = new ScreenerAPI();
    
    // Show loading state immediately
    this.showLoading();
    
    // Initialize asynchronously
    this.init().catch(error => {
      console.error('❌ FilterBuilder initialization failed:', error);
      this.showError('Failed to initialize filter builder: ' + error.message);
    });
  }

  async init() {
    try {
      console.log('🚀 Initializing FilterBuilder...');
      
      // Load field metadata
      this.fieldMetadata = await this.api.getFieldsMetadata();
      
      if (!this.fieldMetadata || !this.fieldMetadata.fields) {
        throw new Error('Invalid field metadata received');
      }
      
      // Create initial empty filter group
      this.filterGroups = [FilterUtils.createEmptyGroup()];
      
      // Render the UI
      this.render();
      
      console.log('✅ FilterBuilder initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing FilterBuilder:', error);
      
      // Try fallback: load from static file directly
      try {
        console.log('🔄 Trying fallback: loading fields.json directly...');
        const fallbackResponse = await fetch('/static/fields.json');
        if (fallbackResponse.ok) {
          this.fieldMetadata = await fallbackResponse.json();
          this.filterGroups = [FilterUtils.createEmptyGroup()];
          this.render();
          console.log('✅ FilterBuilder initialized with fallback method');
          return;
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
      }
      
      // Show error if both methods failed
      this.showError(`Failed to load field metadata: ${error.message}`);
    }
  }

  render() {
    if (!this.container) {
      console.error('❌ Container element not found');
      return;
    }

    this.container.innerHTML = `
      <div class="filter-builder">
        <div class="filter-builder-header">
          <h3>🔍 Dynamic Stock Screener</h3>
          <div class="filter-builder-actions">
            <button class="btn btn-secondary" onclick="filterBuilder.addGroup()">
              ➕ Add Group
            </button>
            <button class="btn btn-primary" onclick="filterBuilder.runScreener()">
              🚀 Run Screener
            </button>
          </div>
        </div>
        
        <div class="filter-groups-container">
          ${this.renderFilterGroups()}
        </div>
        
        ${this.options.showPreview ? this.renderPreview() : ''}
        
        <div class="filter-results" id="filterResults" style="display: none;">
          <!-- Results will be inserted here -->
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  renderFilterGroups() {
    return this.filterGroups.map((group, index) => 
      this.renderFilterGroup(group, index, 0)
    ).join('');
  }

  renderFilterGroup(group, index, depth) {
    const isNested = depth > 0;
    const canNest = this.options.allowNesting && depth < this.options.maxNestingDepth;
    
    return `
      <div class="filter-group ${isNested ? 'nested' : ''}" data-group-id="${group.id}" data-depth="${depth}">
        <div class="filter-group-header">
          <div class="filter-group-controls">
            <label class="group-enabled">
              <input type="checkbox" ${group.enabled ? 'checked' : ''} 
                     onchange="filterBuilder.toggleGroup('${group.id}')">
              <span class="group-title">${isNested ? 'Nested Group' : 'Filter Group'} ${index + 1}</span>
            </label>
            
            <select class="logical-operator" onchange="filterBuilder.updateGroupOperator('${group.id}', this.value)">
              <option value="AND" ${group.logical_operator === 'AND' ? 'selected' : ''}>AND</option>
              <option value="OR" ${group.logical_operator === 'OR' ? 'selected' : ''}>OR</option>
            </select>
          </div>
          
          <div class="filter-group-actions">
            ${canNest ? `<button class="btn btn-sm btn-outline" onclick="filterBuilder.addNestedGroup('${group.id}')">
              ➕ Nested Group
            </button>` : ''}
            <button class="btn btn-sm btn-outline" onclick="filterBuilder.addRule('${group.id}')">
              ➕ Rule
            </button>
            ${!isNested ? `<button class="btn btn-sm btn-danger" onclick="filterBuilder.removeGroup('${group.id}')">
              🗑️ Remove Group
            </button>` : ''}
          </div>
        </div>
        
        <div class="filter-rules">
          ${group.rules.map((rule, ruleIndex) => this.renderFilterRule(rule, group.id, ruleIndex)).join('')}
        </div>
        
        ${group.nested_groups.length > 0 ? `
          <div class="nested-groups">
            ${group.nested_groups.map((nestedGroup, nestedIndex) => 
              this.renderFilterGroup(nestedGroup, nestedIndex, depth + 1)
            ).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  renderFilterRule(rule, groupId, ruleIndex) {
    const leftField = this.fieldMetadata.fields.find(f => f.Name === rule.left_operand.value);
    const fieldType = leftField ? leftField.Type : 'number';
    const operators = FilterUtils.getOperatorsForType(fieldType);
    const isFieldOperator = FilterUtils.isFieldOperator(rule.operator);
    const isPercentageOperator = FilterUtils.isPercentageOperator(rule.operator);
    const requiresArray = FilterUtils.requiresArrayValue(rule.operator);
    
    return `
      <div class="filter-rule" data-rule-id="${rule.id}">
        <div class="rule-controls">
          <label class="rule-enabled">
            <input type="checkbox" ${rule.enabled ? 'checked' : ''} 
                   onchange="filterBuilder.toggleRule('${rule.id}')">
          </label>
          
          <!-- Left Operand (Field) -->
          <div class="operand left-operand">
            ${this.renderFieldSelect(rule.left_operand.value, `filterBuilder.updateRuleLeftField('${rule.id}', this.value)`)}
          </div>
          
          <!-- Operator -->
          <div class="operator">
            <select onchange="filterBuilder.updateRuleOperator('${rule.id}', this.value)">
              ${operators.map(op => `
                <option value="${op.value}" ${rule.operator === op.value ? 'selected' : ''} 
                        title="${op.description}">
                  ${op.label}
                </option>
              `).join('')}
            </select>
          </div>
          
          <!-- Right Operand -->
          <div class="operand right-operand">
            ${isPercentageOperator ? 
              this.renderPercentageInput(rule.right_operand.value, `filterBuilder.updateRuleRightValue('${rule.id}', this.value)`) :
              isFieldOperator ? 
                this.renderFieldSelect(rule.right_operand.value, `filterBuilder.updateRuleRightField('${rule.id}', this.value)`) :
                this.renderValueInput(rule.right_operand.value, fieldType, requiresArray, `filterBuilder.updateRuleRightValue('${rule.id}', this.value)`)
            }
          </div>
          
          <button class="btn btn-sm btn-danger" onclick="filterBuilder.removeRule('${groupId}', '${rule.id}')">
            ✖️
          </button>
        </div>
      </div>
    `;
  }

  renderFieldSelect(selectedValue, onChangeHandler) {
    if (!this.fieldMetadata) return '<select disabled><option>Loading...</option></select>';
    
    const groupedOptions = this.fieldMetadata.groups.map(groupName => {
      const groupFields = this.fieldMetadata.grouped_fields[groupName] || [];
      return `
        <optgroup label="${groupName}">
          ${groupFields.map(field => `
            <option value="${field.Name}" ${selectedValue === field.Name ? 'selected' : ''}>
              ${field["Display name"]}
            </option>
          `).join('')}
        </optgroup>
      `;
    }).join('');

    return `
      <select class="field-select" onchange="${onChangeHandler}">
        <option value="">Select field...</option>
        ${groupedOptions}
      </select>
    `;
  }

  renderValueInput(value, fieldType, isArray, onChangeHandler) {
    if (isArray) {
      const arrayValue = Array.isArray(value) ? value.join(', ') : '';
      return `
        <input type="text" class="value-input array-input" 
               value="${arrayValue}" 
               placeholder="Enter values separated by commas"
               onchange="filterBuilder.updateRuleRightArrayValue('${rule.id}', this.value)"
               title="Enter multiple values separated by commas">
      `;
    }
    
    const inputType = fieldType === 'number' ? 'number' : 'text';
    const placeholder = fieldType === 'number' ? 'Enter number...' : 'Enter text...';
    
    return `
      <input type="${inputType}" class="value-input" 
             value="${value}" 
             placeholder="${placeholder}"
             onchange="${onChangeHandler}">
    `;
  }

  renderPercentageInput(value, onChangeHandler) {
    // Parse existing value if it's an object
    let fieldValue = '';
    let percentageValue = '';
    
    if (typeof value === 'object' && value !== null) {
      fieldValue = value.field || '';
      percentageValue = value.percentage || '';
    }
    
    return `
      <div class="percentage-input-container">
        <div class="field-percentage-row">
          <div class="field-part">
            ${this.renderFieldSelect(fieldValue, `filterBuilder.updatePercentageField('${onChangeHandler}', this.value)`)}
          </div>
          <div class="percentage-part">
            <div class="input-group">
              <input type="number" 
                     class="value-input percentage-input" 
                     value="${percentageValue}" 
                     placeholder="5.0"
                     step="0.1"
                     min="0"
                     max="100"
                     onchange="filterBuilder.updatePercentageValue('${onChangeHandler}', this.value)">
              <span class="input-group-text">%</span>
            </div>
          </div>
        </div>
        <small class="text-muted">Compare field A to field B ± percentage</small>
      </div>
    `;
  }

  renderPreview() {
    const description = FilterUtils.describeFilters(this.filterGroups, this.fieldMetadata);
    
    return `
      <div class="filter-preview">
        <h4>📋 Filter Preview</h4>
        <div class="preview-content">
          <code>${description}</code>
        </div>
        <details class="json-preview">
          <summary>🔧 JSON Structure</summary>
          <pre><code>${JSON.stringify({ filter_groups: this.filterGroups }, null, 2)}</code></pre>
        </details>
      </div>
    `;
  }

  // Event handlers
  attachEventListeners() {
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.runScreener();
        }
      }
    });
  }

  // Group management
  addGroup() {
    const newGroup = FilterUtils.createEmptyGroup();
    this.filterGroups.push(newGroup);
    this.render();
  }

  removeGroup(groupId) {
    this.filterGroups = this.filterGroups.filter(g => g.id !== groupId);
    if (this.filterGroups.length === 0) {
      this.filterGroups = [FilterUtils.createEmptyGroup()];
    }
    this.render();
  }


  toggleGroup(groupId) {
    const group = this.findGroup(groupId);
    if (group) {
      group.enabled = !group.enabled;
      this.updatePreview();
    }
  }

  updateGroupOperator(groupId, operator) {
    const group = this.findGroup(groupId);
    if (group) {
      group.logical_operator = operator;
      this.updatePreview();
    }
  }

  addNestedGroup(parentGroupId) {
    const parentGroup = this.findGroup(parentGroupId);
    if (parentGroup) {
      const nestedGroup = FilterUtils.createEmptyGroup();
      parentGroup.nested_groups.push(nestedGroup);
      this.render();
    }
  }

  // Rule management
  addRule(groupId) {
    const group = this.findGroup(groupId);
    if (group) {
      const newRule = FilterUtils.createEmptyRule();
      group.rules.push(newRule);
      this.render();
    }
  }

  removeRule(groupId, ruleId) {
    const group = this.findGroup(groupId);
    if (group) {
      group.rules = group.rules.filter(r => r.id !== ruleId);
      if (group.rules.length === 0) {
        group.rules = [FilterUtils.createEmptyRule()];
      }
      this.render();
    }
  }

  toggleRule(ruleId) {
    const rule = this.findRule(ruleId);
    if (rule) {
      rule.enabled = !rule.enabled;
      this.updatePreview();
    }
  }

  updateRuleLeftField(ruleId, fieldName) {
    const rule = this.findRule(ruleId);
    if (rule) {
      const field = this.fieldMetadata.fields.find(f => f.Name === fieldName);
      rule.left_operand.value = fieldName;
      rule.left_operand.field_type = field ? field.Type : 'number';
      
      // Reset operator to default for new field type
      const operators = FilterUtils.getOperatorsForType(field ? field.Type : 'number');
      rule.operator = operators[0].value;
      
      this.render();
    }
  }

  updateRuleOperator(ruleId, operator) {
    const rule = this.findRule(ruleId);
    if (rule) {
      rule.operator = operator;
      
      // Reset right operand based on operator type
      if (FilterUtils.isPercentageOperator(operator)) {
        rule.right_operand = { 
          type: "field", 
          value: { field: "", percentage: 0 } 
        };
      } else if (FilterUtils.isFieldOperator(operator)) {
        rule.right_operand = { type: "field", value: "" };
      } else {
        rule.right_operand = { 
          type: "constant", 
          value: FilterUtils.requiresArrayValue(operator) ? [] : "" 
        };
      }
      
      this.render();
    }
  }

  updateRuleRightField(ruleId, fieldName) {
    const rule = this.findRule(ruleId);
    if (rule) {
      rule.right_operand.value = fieldName;
      this.updatePreview();
    }
  }

  updateRuleRightValue(ruleId, value) {
    const rule = this.findRule(ruleId);
    if (rule) {
      rule.right_operand.value = value;
      this.updatePreview();
    }
  }

  updateRuleRightArrayValue(ruleId, value) {
    const rule = this.findRule(ruleId);
    if (rule) {
      rule.right_operand.value = value.split(',').map(v => v.trim()).filter(v => v);
      this.updatePreview();
    }
  }

  updatePercentageField(onChangeHandler, fieldValue) {
    // Extract rule ID from the onChangeHandler string
    const ruleId = this.extractRuleIdFromHandler(onChangeHandler);
    const rule = this.findRule(ruleId);
    
    if (rule) {
      // Initialize or update the percentage object
      if (typeof rule.right_operand.value !== 'object') {
        rule.right_operand.value = { field: '', percentage: 0 };
      }
      rule.right_operand.value.field = fieldValue;
      this.updatePreview();
    }
  }

  updatePercentageValue(onChangeHandler, percentageValue) {
    // Extract rule ID from the onChangeHandler string
    const ruleId = this.extractRuleIdFromHandler(onChangeHandler);
    const rule = this.findRule(ruleId);
    
    if (rule) {
      // Initialize or update the percentage object
      if (typeof rule.right_operand.value !== 'object') {
        rule.right_operand.value = { field: '', percentage: 0 };
      }
      rule.right_operand.value.percentage = parseFloat(percentageValue) || 0;
      this.updatePreview();
    }
  }

  extractRuleIdFromHandler(handlerString) {
    // Extract rule ID from handler string like "filterBuilder.updateRuleRightValue('rule_123', this.value)"
    const match = handlerString.match(/'([^']+)'/);
    return match ? match[1] : null;
  }

  // Utility methods
  findGroup(groupId) {
    const findInGroups = (groups) => {
      for (const group of groups) {
        if (group.id === groupId) return group;
        const found = findInGroups(group.nested_groups);
        if (found) return found;
      }
      return null;
    };
    return findInGroups(this.filterGroups);
  }

  findRule(ruleId) {
    const findInGroups = (groups) => {
      for (const group of groups) {
        const rule = group.rules.find(r => r.id === ruleId);
        if (rule) return rule;
        const found = findInGroups(group.nested_groups);
        if (found) return found;
      }
      return null;
    };
    return findInGroups(this.filterGroups);
  }

  updatePreview() {
    if (this.options.showPreview) {
      const previewElement = this.container.querySelector('.filter-preview .preview-content code');
      const jsonElement = this.container.querySelector('.json-preview pre code');
      
      if (previewElement) {
        const description = FilterUtils.describeFilters(this.filterGroups, this.fieldMetadata);
        previewElement.textContent = description;
      }
      
      if (jsonElement) {
        jsonElement.textContent = JSON.stringify({ filter_groups: this.filterGroups }, null, 2);
      }
    }
  }

  // Main screener execution
  async runScreener() {
    try {
      const resultsContainer = document.getElementById('filterResults');
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = '<div class="loading">🔄 Running screener...</div>';

      // Validate filters
      const errors = this.validateFilters();
      if (errors.length > 0) {
        throw new Error('Validation errors: ' + errors.join(', '));
      }

      // Validate filterGroups is an array
      if (!Array.isArray(this.filterGroups)) {
        throw new Error(`filterGroups is not an array: ${typeof this.filterGroups} = ${this.filterGroups}`);
      }

      console.log(`🔍 FilterGroups validation: ${this.filterGroups.length} groups`);
      this.filterGroups.forEach((group, i) => {
        console.log(`   Group ${i}: ${group.id}, rules: ${group.rules ? group.rules.length : 'undefined'}`);
        if (group.rules && Array.isArray(group.rules)) {
          group.rules.forEach((rule, j) => {
            console.log(`     Rule ${j}: ${rule.left_operand?.value} ${rule.operator} ${rule.right_operand?.value}`);
          });
        }
      });

      // Create screener request
      const screenerRequest = {
        filter_groups: this.filterGroups,
        columns: null, // Use defaults
        limit: null,
        sort_by: "market_cap_basic",
        sort_ascending: false
      };

      console.log(`📋 Screener request created:`, screenerRequest);

      // Submit request
      const result = await this.api.submitScreenerRequest(screenerRequest);

      // Display results
      this.displayResults(result);

    } catch (error) {
      console.error('❌ Error running screener:', error);
      this.showError(error.message);
    }
  }

  validateFilters() {
    const errors = [];
    
    for (const group of this.filterGroups) {
      if (!group.enabled) continue;
      
      for (const rule of group.rules) {
        if (!rule.enabled) continue;
        
        const ruleErrors = FilterUtils.validateRule(rule, this.fieldMetadata);
        errors.push(...ruleErrors);
      }
    }
    
    return errors;
  }

  displayResults(result) {
    const resultsContainer = document.getElementById('filterResults');
    
    if (!result.success) {
      resultsContainer.innerHTML = `
        <div class="error">
          ❌ ${result.message || 'Screener failed'}
        </div>
      `;
      return;
    }

    const tableHtml = this.createResultsTable(result.data, result.columns);
    
    resultsContainer.innerHTML = `
      <div class="results-header">
        <h4>📊 Screener Results</h4>
        <div class="results-info">
          Found <strong>${result.count}</strong> symbols
          ${result.csv_data ? `
            <button class="btn btn-secondary" onclick="filterBuilder.downloadResults('${result.filename}')">
              📥 Download CSV
            </button>
          ` : ''}
        </div>
      </div>
      <div class="results-table-container">
        ${tableHtml}
      </div>
    `;

    // Store results for download
    this.lastResults = result;
  }

  createResultsTable(data, columns) {
    if (!data || data.length === 0) {
      return '<div class="no-results">No results found</div>';
    }

    const headerRow = columns.map(col => `<th>${col}</th>`).join('');
    const dataRows = data.slice(0, 50).map(row => { // Limit to first 50 for performance
      const cells = columns.map(col => {
        let value = row[col];
        
        // Format numbers
        if (typeof value === 'number') {
          if (col.includes('price') || col === 'close' || col === 'open' || col === 'high' || col === 'low') {
            value = '$' + value.toFixed(2);
          } else if (col.includes('percent') || col.includes('%') || col === 'change') {
            value = value.toFixed(2) + '%';
          } else if (col.includes('volume') || col === 'market_cap_basic') {
            value = value.toLocaleString();
          } else {
            value = value.toFixed(2);
          }
        }
        
        // Create TradingView link for symbol
        if (col === 'name' && row.tradingview_link) {
          value = `<a href="${row.tradingview_link}" target="_blank" class="symbol-link">${value}</a>`;
        }
        
        return `<td>${value || ''}</td>`;
      }).join('');
      
      return `<tr>${cells}</tr>`;
    }).join('');

    return `
      <table class="results-table">
        <thead>
          <tr>${headerRow}</tr>
        </thead>
        <tbody>
          ${dataRows}
        </tbody>
      </table>
      ${data.length > 50 ? `<div class="table-note">Showing first 50 of ${data.length} results. Download CSV for complete data.</div>` : ''}
    `;
  }

  async downloadResults(filename) {
    if (this.lastResults && this.lastResults.csv_data) {
      try {
        await this.api.downloadCSV(this.lastResults.csv_data, filename);
      } catch (error) {
        this.showError('Failed to download CSV: ' + error.message);
      }
    }
  }

  showLoading() {
    if (!this.container) {
      console.error('❌ Container element not found');
      return;
    }
    
    this.container.innerHTML = `
      <div class="filter-builder-loading">
        <div class="loading-spinner">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <p class="mt-3">Loading filter builder...</p>
        <small class="text-muted">Fetching field metadata...</small>
      </div>
    `;
  }

  showError(message) {
    if (!this.container) {
      console.error('❌ Container element not found for error display');
      return;
    }
    
    this.container.innerHTML = `
      <div class="filter-builder-error">
        <div class="alert alert-danger" role="alert">
          <h4 class="alert-heading">❌ Error Loading Filter Builder</h4>
          <p>${message}</p>
          <hr>
          <div class="d-flex justify-content-between">
            <button class="btn btn-outline-danger" onclick="location.reload()">
              🔄 Retry
            </button>
            <button class="btn btn-outline-secondary" onclick="window.close()">
              ← Back
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// Global instance for easy access
let filterBuilder = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('filterBuilderContainer')) {
    filterBuilder = new FilterBuilder('filterBuilderContainer');
  }
});

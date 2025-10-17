# Static Data References - Update Todo List

This document lists all static data references found in the SmartTaxes codebase that should be updated to be more maintainable and configurable.

## 🏛️ Tax Data & Constants

### 1. Federal Tax Brackets & Deductions (HIGH PRIORITY)
**File:** `server/routes.ts` (lines 32-76)
- **Issue:** Hardcoded 2024 tax brackets and standard deductions
- **Impact:** Will need manual updates each tax year
- **Action:** Move to configuration file or database table
- **Data:**
  - `TAX_BRACKETS_2024` - All filing status brackets with min/max/rate
  - `STANDARD_DEDUCTION_2024` - Standard deductions by filing status

### 2. State Tax Data (HIGH PRIORITY)
**File:** `server/services/stateTaxService.ts` (lines 22-66)
- **Issue:** Hardcoded state tax brackets and deductions for CA, NY, TX
- **Impact:** Limited state support, manual updates needed
- **Action:** Create comprehensive state tax configuration system
- **Data:**
  - `stateTaxBrackets` - CA and NY tax brackets
  - `stateStandardDeductions` - State-specific deductions

### 3. Tax Filing Deadlines (MEDIUM PRIORITY)
**Files:** 
- `server/services/efileService.ts` (lines 300-307)
- `server/services/stateTaxService.ts` (lines 283-284)
- `server/services/pdfService.ts` (lines 348, 353)
- **Issue:** Hardcoded "April 15th" deadlines
- **Impact:** Doesn't account for weekend/holiday adjustments
- **Action:** Create dynamic deadline calculation system

## 🏗️ Application Configuration

### 4. Environment Configuration (HIGH PRIORITY)
**File:** `env.example` (lines 1-37)
- **Issue:** Static configuration template
- **Impact:** Manual setup required for each deployment
- **Action:** Create dynamic configuration management
- **Data:**
  - Database URLs
  - API keys placeholders
  - File upload limits
  - Service endpoints

### 5. Docker Configuration (MEDIUM PRIORITY)
**File:** `docker-compose.yml` (lines 1-78)
- **Issue:** Hardcoded database credentials and service configurations
- **Impact:** Security risk, inflexible deployment
- **Action:** Use environment variables for all sensitive data
- **Data:**
  - Database credentials
  - Service ports
  - Volume paths

## 🎨 UI Constants & Options

### 6. Form Options (MEDIUM PRIORITY)
**File:** `client/src/pages/profile.tsx` (lines 41-65)
- **Issue:** Hardcoded dropdown options
- **Impact:** Difficult to maintain, not internationalized
- **Action:** Move to configuration files
- **Data:**
  - `FILING_STATUS_OPTIONS` - Tax filing statuses
  - `DEPENDENT_RELATIONSHIP_OPTIONS` - Dependent relationships
  - `US_STATES` - US state codes

### 7. UI Constants (LOW PRIORITY)
**Files:**
- `client/src/hooks/use-mobile.tsx` (line 3)
- `client/src/hooks/use-toast.ts` (lines 8-9)
- `client/src/components/ui/sidebar.tsx` (lines 28-33)
- **Issue:** Hardcoded UI breakpoints and timing values
- **Impact:** Inconsistent UX across components
- **Action:** Centralize UI constants

## 🤖 AI & Parsing Configuration

### 8. LLM Service Configuration (MEDIUM PRIORITY)
**File:** `server/services/llmService.ts` (lines 21-25)
- **Issue:** Hardcoded model settings and API endpoints
- **Impact:** Difficult to switch models or adjust parameters
- **Action:** Make configurable via environment variables
- **Data:**
  - Default model selection
  - Token limits
  - Temperature settings
  - API base URL

### 9. Document Type Definitions (MEDIUM PRIORITY)
**File:** `shared/schema.ts` (lines 488-493)
- **Issue:** Hardcoded document type constants
- **Impact:** Difficult to add new document types
- **Action:** Create dynamic document type system
- **Data:**
  - `DOCUMENT_TYPES` - W-2, 1099-DIV, etc.

### 10. Parsing Thresholds (LOW PRIORITY)
**File:** `server/services/parsingService.ts` (line 25)
- **Issue:** Hardcoded confidence threshold
- **Impact:** Cannot adjust parsing sensitivity
- **Action:** Make configurable per document type

## 📊 Business Logic Constants

### 11. File Upload Configuration (MEDIUM PRIORITY)
**File:** `env.example` (lines 33-34)
- **Issue:** Hardcoded file size and type limits
- **Impact:** Cannot adjust limits without code changes
- **Action:** Move to runtime configuration
- **Data:**
  - `MAX_FILE_SIZE` - 10485760 bytes
  - `ALLOWED_FILE_TYPES` - pdf,jpg,jpeg,png

### 12. Database Schema Defaults (LOW PRIORITY)
**File:** `shared/schema.ts` (multiple lines)
- **Issue:** Hardcoded default values in schema
- **Impact:** Difficult to change defaults without migration
- **Action:** Consider making defaults configurable
- **Data:**
  - Default filing status: "single"
  - Default subscription tier: "free"
  - Various boolean defaults

## 🔧 Development & Build Configuration

### 13. Package Configuration (LOW PRIORITY)
**File:** `package.json` (lines 1-132)
- **Issue:** Hardcoded version numbers and scripts
- **Impact:** Manual dependency management
- **Action:** Consider automated dependency updates
- **Data:**
  - All dependency versions
  - Build scripts
  - Deployment commands

## 📋 Implementation Priority

### Phase 1 (Critical - Week 1)
1. **Tax Data Configuration** - Move tax brackets and deductions to database
2. **Environment Configuration** - Create dynamic config management
3. **State Tax Expansion** - Add support for all 50 states

### Phase 2 (Important - Week 2)
4. **Filing Deadlines** - Implement dynamic deadline calculation
5. **LLM Configuration** - Make AI settings configurable
6. **File Upload Limits** - Runtime configuration

### Phase 3 (Enhancement - Week 3)
7. **UI Constants** - Centralize form options and UI settings
8. **Document Types** - Dynamic document type system
9. **Parsing Thresholds** - Configurable confidence levels

### Phase 4 (Maintenance - Week 4)
10. **Docker Security** - Environment variable migration
11. **Schema Defaults** - Configurable database defaults
12. **Development Tools** - Automated dependency management

## 🎯 Success Metrics

- [ ] All tax data externalized from code
- [ ] Environment-specific configurations working
- [ ] All 50 states supported for tax calculations
- [ ] Dynamic deadline calculations implemented
- [ ] AI model settings configurable
- [ ] File upload limits adjustable at runtime
- [ ] Form options internationalized
- [ ] Document types extensible
- [ ] Parsing sensitivity adjustable
- [ ] Docker deployment secure
- [ ] Database defaults configurable
- [ ] Automated dependency updates

## 📝 Notes

- Consider using a configuration management system (e.g., Consul, etcd)
- Implement feature flags for gradual rollout of changes
- Create migration scripts for database schema changes
- Add validation for all configuration values
- Consider using environment-specific configuration files
- Implement configuration hot-reloading where possible

---
*Generated on: January 2025*
*Total Static Data References Found: 13 major categories*

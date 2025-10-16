# Tax Filing Application Design Guidelines

## Design Approach: Utility-First Financial Interface

**Selected Framework:** Design System Approach with financial application patterns
**Primary References:** TurboTax (workflow), Stripe Dashboard (data presentation), Material Design (component system)
**Rationale:** Tax filing is utility-focused, requiring clarity, trust, and efficient data processing over visual flair. Users prioritize accuracy and ease of use.

---

## Core Design Principles

1. **Trust Through Clarity:** Clean, professional aesthetic that instills confidence in handling sensitive financial data
2. **Progressive Disclosure:** Guide users through complex tax workflows without overwhelming them
3. **Data Transparency:** Make all calculations visible and verifiable
4. **Error Prevention:** Proactive validation with clear, actionable feedback

---

## Color Palette

### Light Mode (Primary)
- **Primary Brand:** 220 85% 25% (deep professional blue)
- **Primary Hover:** 220 85% 20%
- **Success/Verified:** 142 71% 35% (trustworthy green)
- **Warning/Review:** 38 92% 50% (attention orange)
- **Error/Required:** 0 84% 45% (clear red)
- **Background:** 0 0% 100% (pure white)
- **Surface:** 220 15% 97% (soft gray)
- **Border:** 220 13% 91%
- **Text Primary:** 220 15% 20%
- **Text Secondary:** 220 10% 45%

### Dark Mode (Optional Support)
- **Background:** 220 15% 10%
- **Surface:** 220 15% 15%
- **Border:** 220 10% 25%
- **Text Primary:** 220 5% 95%
- **Text Secondary:** 220 5% 70%

---

## Typography

**Font Families:**
- Primary: 'Inter' (Google Fonts) - All UI text, forms, data tables
- Monospace: 'JetBrains Mono' - Financial figures, tax amounts, transaction IDs

**Type Scale:**
- Hero/Page Title: text-4xl font-bold (36px)
- Section Headers: text-2xl font-semibold (24px)
- Card Titles: text-lg font-medium (18px)
- Body Text: text-base font-normal (16px)
- Helper Text: text-sm font-normal (14px)
- Financial Data: text-base font-mono (16px, monospace)
- Small Labels: text-xs font-medium (12px, uppercase tracking)

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-4 to p-6
- Section spacing: space-y-8 to space-y-12
- Card gaps: gap-6
- Form field spacing: space-y-4

**Container Strategy:**
- Dashboard Layout: max-w-7xl mx-auto px-6
- Form Containers: max-w-3xl mx-auto
- Data Tables: Full width within max-w-7xl
- Two-column review: grid grid-cols-1 lg:grid-cols-2 gap-8

**Responsive Breakpoints:**
- Mobile: Base styles (forms stack, single column)
- Tablet: md: (two-column layouts for comparison views)
- Desktop: lg: (full dashboard layout, side-by-side document review)

---

## Component Library

### Navigation & Layout
**Top Navigation Bar:**
- Fixed header with white background, shadow-sm
- Logo (left), progress indicator (center), user menu (right)
- Height: h-16
- Contains: Save draft, Tax year selector, Profile dropdown

**Sidebar Navigation (Dashboard):**
- Width: w-64
- Sections: Upload, Review, Calculate, Forms, Summary
- Active state: bg-blue-50 with left border-l-4 border-primary
- Icons from Heroicons (document, calculator, folder, chart-bar)

**Step Progress Indicator:**
- Horizontal stepper for tax workflow
- Completed: Filled circle with checkmark (green)
- Current: Blue filled circle with border
- Upcoming: Gray outline circle
- Connected by lines

### Data Entry & Forms

**File Upload Zone:**
- Large drag-drop area: min-h-64 border-2 border-dashed
- Hover state: bg-blue-50 border-blue-400
- Accepted formats displayed: text-sm text-gray-500
- Upload icon: cloud-upload (heroicons)
- Multiple file preview cards below upload zone

**Document Preview Cards:**
- White card with shadow-sm, rounded-lg, p-4
- Document type badge (top-right, colored by type)
- Filename: font-medium, text-gray-900
- File size and upload time: text-sm text-gray-500
- Actions: View, Delete icons
- Status indicator: Parsed (green), Processing (orange), Error (red)

**Form Fields:**
- Label: font-medium text-gray-700 mb-1
- Input: border border-gray-300 rounded-lg px-4 py-2.5
- Focus: ring-2 ring-primary ring-offset-2
- Error: border-red-500 with error message text-sm text-red-600
- Currency inputs: Font-mono with $ prefix, right-aligned
- Disabled state: bg-gray-100 cursor-not-allowed

**Data Review Table:**
- Alternating row colors: even:bg-gray-50
- Header: bg-gray-100 font-semibold sticky top-0
- Cell padding: px-4 py-3
- Editable cells: Clickable with pencil icon, inline edit on click
- Comparison columns: Original (from document) | Detected | Corrected
- Highlight differences: bg-yellow-100 for mismatches

### Calculations & Results

**Tax Summary Cards:**
- Grid layout: grid-cols-1 md:grid-cols-3 gap-6
- Card structure: bg-white rounded-xl shadow p-6
- Icon (top): Circular bg-blue-100 with blue icon
- Label: text-sm text-gray-500 uppercase
- Amount: text-3xl font-bold font-mono
- Sub-detail: text-sm text-gray-600 mt-2

**Calculation Breakdown:**
- Accordion sections for income types
- Expandable rows showing line-by-line calculations
- Reference to IRS form line numbers: text-xs text-gray-400
- Running totals: font-semibold border-t-2 pt-2

**Form 1040 Preview:**
- Split view: Original IRS form layout (left) | Populated values (right)
- Form line numbers: Monospace, gray
- User data: Blue text, editable on click
- Calculated fields: Green text, lock icon
- PDF-like rendering with proper spacing

### Feedback & Validation

**Alert Banners:**
- Success: bg-green-50 border-l-4 border-green-500 text-green-800
- Warning: bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800
- Error: bg-red-50 border-l-4 border-red-500 text-red-800
- Info: bg-blue-50 border-l-4 border-blue-500 text-blue-800
- Icon + message + dismiss button

**Validation Indicators:**
- Inline checkmark: Green check-circle icon next to validated fields
- Missing data: Orange exclamation-triangle with "Required" badge
- Flagged items: Red flag icon with hover tooltip explanation

**Loading States:**
- File parsing: Indeterminate progress bar with percentage
- Tax calculation: Spinner with "Calculating..." text
- Document upload: Progress ring around file icon

### Actions & CTAs

**Primary Button:**
- bg-primary text-white rounded-lg px-6 py-3 font-medium
- Hover: bg-primary-hover
- Disabled: opacity-50 cursor-not-allowed
- Loading: Spinner replacing text

**Secondary Button:**
- border border-gray-300 bg-white text-gray-700 rounded-lg px-6 py-3
- Hover: bg-gray-50

**Icon Buttons:**
- Size: h-10 w-10
- Hover: bg-gray-100 rounded-lg
- Used for: Edit, Delete, Download, View

---

## Animations & Interactions

**Minimal Motion Approach:**
- Transitions: transition-all duration-200 ease-in-out
- Hover states: Scale or background color changes only
- Page transitions: Fade in new content (opacity)
- Avoid: Slides, bounces, rotations
- File upload: Smooth progress bar fill

**Focus States:**
- Keyboard navigation: Prominent ring-2 ring-primary outline
- Skip to main content link for accessibility

---

## Images & Visual Elements

**No Hero Images** - This is a utility application, not a marketing site

**Icons:**
- Library: Heroicons (via CDN)
- Usage: Navigation items, document types, status indicators, form fields
- Document type icons: document-text, calculator, currency-dollar
- Status icons: check-circle, exclamation-triangle, x-circle
- Size: h-5 w-5 for inline, h-8 w-8 for cards

**Charts (Tax Summary Dashboard):**
- Library: Chart.js or Recharts
- Types: Donut chart (income breakdown), Bar chart (multi-year comparison)
- Colors: Use primary palette with different opacity levels

**Document Type Badges:**
- Small colored pills: W-2 (blue), 1099-DIV (green), 1099-INT (purple), 1099-B (orange)
- Format: px-2 py-1 rounded-full text-xs font-medium

---

## Page-Specific Layouts

### Dashboard (Landing After Login)
- Header with nav
- Welcome message with current tax year
- Quick stats cards: Documents uploaded, Forms completed, Estimated refund/owed
- Recent uploads list
- CTA: "Upload new document" button (primary)

### Upload Page
- Large file upload zone (center)
- Supported formats explanation
- Preview grid of uploaded documents below
- Batch actions: Process all, Delete selected

### Review Page
- Two-column layout: Document viewer (left, 50%) | Extracted data table (right, 50%)
- Sticky header with document selector dropdown
- Validation summary at top
- Field-by-field editing capability

### Tax Summary
- Three-column summary cards at top
- Accordion breakdown sections
- Form 1040 preview (full width)
- Export/Print button (bottom-right)

---

## Accessibility & Dark Mode

- WCAG 2.1 AA compliance minimum
- All interactive elements: min-h-11 touch target
- Form labels: Properly associated with inputs
- Error announcements: aria-live regions
- Dark mode: Consistent implementation across all forms, inputs maintain readability
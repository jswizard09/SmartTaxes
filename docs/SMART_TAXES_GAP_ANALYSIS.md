# SmartTaxes Gap Analysis & Build Plan

## What exists today
- Upload pipeline supports PDF/CSV/Excel/Image + OCR fallback.
- Form extraction exists for W-2, 1099-DIV, 1099-INT, 1099-B, and partial 1099-MISC/consolidated brokerage.
- Users can review and edit extracted values, then calculate preview 1040 / schedule outputs.
- AI insights service already exists to generate suggestions.

## Gaps to reach your goal
1. **Coverage transparency:** users need a clear list of supported vs unsupported 1099 variants.
2. **Unsupported safety:** recognized but unsupported 1099 forms should be explicitly blocked from tax calculations.
3. **Financial coaching depth:** suggestions should be split into compliant tax optimization, cash-flow hygiene, and long-term wealth planning.
4. **Learning loop:** user edits should feed parser quality metrics and retraining data.

## Recommended delivery phases
### Phase 1: Reliability (now)
- Publish support matrix in UI/API.
- Flag unsupported 1099 docs (NEC/K/R/G/etc.) as not included in tax math.
- Add confidence + missing fields review checklist before final preview.

### Phase 2: Coverage expansion
- Add parsers for 1099-NEC, 1099-R, 1099-K (highest volume unsupported forms).
- Expand 1099-B to better handle broker-specific multi-lot table layouts.
- Add bank/broker statement adapters with broker template registry.

### Phase 3: Financial education copilot
- Add “Improve my financial life” panel with:
  - tax-aware cash-flow ideas,
  - retirement/HSA optimization,
  - capital gain/loss harvesting education,
  - risk notes and assumptions.
- Keep compliant language: educational only, not legal/investment advice.

### Phase 4: Intelligence + quality
- Add extraction benchmark dataset and nightly accuracy report.
- Human-in-the-loop review for low-confidence fields.
- Add versioned model/parsing telemetry for rollback safety.

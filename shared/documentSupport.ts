export interface DocumentSupportItem {
  documentType: string;
  category: "supported" | "limited" | "unsupported";
  notes: string;
}

export const SUPPORTED_DOCUMENTS: DocumentSupportItem[] = [
  { documentType: "W-2", category: "supported", notes: "Core wage and withholding extraction is implemented." },
  { documentType: "1099-DIV", category: "supported", notes: "Dividend and capital gain distribution boxes are supported." },
  { documentType: "1099-INT", category: "supported", notes: "Interest income and federal withholding fields are supported." },
  { documentType: "1099-B", category: "supported", notes: "Supports transaction-level extraction (single/multiple entries may require review)." },
  { documentType: "1099-MISC", category: "limited", notes: "Detected and parsed, but currently stored as document metadata (not full review tab)." },
  { documentType: "CONSOLIDATED-BROKERAGE", category: "limited", notes: "Section-based parsing for DIV/INT/MISC/B with varying confidence by broker layout." },
];

export const UNSUPPORTED_1099_TYPES = [
  "1099-NEC",
  "1099-R",
  "1099-K",
  "1099-G",
  "1099-OID",
  "1099-Q",
  "1099-SA",
  "1099-C",
  "1099-A",
  "1099-PATR",
  "1099-LTC",
  "1099-S",
] as const;

export const COMMON_UNSUPPORTED_DOCUMENTS: DocumentSupportItem[] = UNSUPPORTED_1099_TYPES.map((documentType) => ({
  documentType,
  category: "unsupported",
  notes: "Document type recognized but not currently used in tax return calculations.",
}));

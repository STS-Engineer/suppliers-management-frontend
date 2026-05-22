/**
 * Supplier Onboarding Constants & Utilities
 * Centralized configuration for form options and constants
 */

export const SUPPLIER_SCOPES = [
  { value: 'local', label: 'Local - Regional supplier, standard evaluations' },
  { value: 'regional', label: 'Regional - Multi-country supplier' },
  { value: 'global', label: 'Global - Strategic supplier, multiple countries' },
] as const;

export const SUPPLIER_TYPES = [
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'service_provider', label: 'Service Provider' },
  { value: 'raw_material', label: 'Raw Material Supplier' },
  { value: 'logistics', label: 'Logistics / Transportation' },
  { value: 'engineering', label: 'Engineering Services' },
  { value: 'other', label: 'Other' },
] as const;

export const COUNTRIES = [
  'China',
  'India',
  'Vietnam',
  'Thailand',
  'Indonesia',
  'Malaysia',
  'Philippines',
  'Taiwan',
  'South Korea',
  'Japan',
  'Germany',
  'France',
  'Italy',
  'Poland',
  'Netherlands',
  'United Kingdom',
  'Spain',
  'Belgium',
  'Austria',
  'Czech Republic',
  'United States',
  'Canada',
  'Mexico',
  'Brazil',
  'Argentina',
  'Australia',
  'New Zealand',
  'Turkey',
  'Russia',
  'Other',
];

export const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
] as const;

export const CERTIFICATIONS = [
  { value: 'ISO 9001', label: 'ISO 9001 - Quality Management System' },
  { value: 'ISO 14001', label: 'ISO 14001 - Environmental Management System' },
  { value: 'ISO 45001', label: 'ISO 45001 - Occupational Health & Safety' },
  { value: 'ISO 50001', label: 'ISO 50001 - Energy Management' },
  { value: 'ISO 13485', label: 'ISO 13485 - Medical Devices Quality' },
  { value: 'ISO/IEC 27001', label: 'ISO/IEC 27001 - Information Security' },
  { value: 'ISO 22301', label: 'ISO 22301 - Business Continuity' },
  { value: 'IATF 16949', label: 'IATF 16949 - Automotive Quality Management' },
  { value: 'RoHS', label: 'RoHS - Hazardous Substances Restriction' },
  { value: 'REACH', label: 'REACH - Chemical Regulations' },
  { value: 'ITAR', label: 'ITAR - International Traffic in Arms' },
  { value: 'ESD', label: 'ESD - Electrostatic Discharge Control' },
  { value: 'Conflict-Free', label: 'Conflict-Free - Minerals Certified' },
  { value: 'FSC', label: 'FSC - Forest Stewardship Council' },
  { value: 'Other', label: 'Other Certification' },
] as const;

export const PLD_TOP_OPTIONS = [
  { value: '30 days net', label: '30 days net' },
  { value: '30 days end of month or +', label: '30 days end of month or +' },
  { value: '60 days net', label: '60 days net' },
  { value: '60 days end of month or +', label: '60 days end of month or +' },
  { value: 'Cash in Advance', label: 'Cash in Advance' },
] as const;

export const PLD_LTA_OPTIONS = [
  { value: '1 year', label: '1 year' },
  { value: '2 years', label: '2 years' },
  { value: '3 years/+', label: '3 years/+' },
  { value: 'None/Invalid', label: 'None/Invalid' },
] as const;

export const PLD_SQMA_OPTIONS = [
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Signed', label: 'Signed' },
  { value: 'Signed m.res.', label: 'Signed m.res.' },
  { value: 'Signed M/Res/not sent', label: 'Signed M/Res/not sent' },
] as const;

export const PLD_FAMILY_COVERAGE_OPTIONS = [
  {
    value: 'Supplier can make 1 family requirements',
    label: 'Supplier can make 1 family requirements',
  },
  {
    value: 'Supplier can make all the family requirements',
    label: 'Supplier can make all the family requirements',
  },
  {
    value: 'Supplier can make only of few family requirements',
    label: 'Supplier can make only of few family requirements',
  },
  {
    value: 'Supplier can make the main family requirements',
    label: 'Supplier can make the main family requirements',
  },
] as const;

export const PLD_COMPETITIVENESS_OPTIONS = [
  { value: 'Best in Fam.', label: 'Best in Fam.' },
  { value: 'Almost Best in Fam.', label: 'Almost Best in Fam.' },
  { value: 'Ave. in Fam.', label: 'Ave. in Fam.' },
  { value: 'Less Avg', label: 'Less Avg' },
  { value: 'Not Comp.', label: 'Not Comp.' },
] as const;

export const PLD_GEO_COVERAGE_OPTIONS = [
  { value: '1 plant is covered', label: '1 plant is covered' },
  { value: 'Main plants covered', label: 'Main plants covered' },
  { value: 'More than 50% plants are covered', label: 'More than 50% plants are covered' },
  { value: 'None', label: 'None' },
] as const;

export const PLD_CONS_OR_WD_OPTIONS = [
  { value: 'Biweekly Del.', label: 'Biweekly Del.' },
  { value: 'Cons. Or Daily Deliveries', label: 'Cons. Or Daily Deliveries' },
  { value: 'DDP or Weekly Del.', label: 'DDP or Weekly Del.' },
  { value: 'Other', label: 'Other' },
] as const;

export const PLD_FINANCIAL_HEALTH_OPTIONS = [
  { value: 'Good', label: 'Good' },
  { value: 'To Monitor', label: 'To Monitor' },
  { value: 'At Risk', label: 'At Risk' },
] as const;

export const PLD_PROD_LIA_INS_OPTIONS = [
  { value: '2M$ or +', label: '2M$ or +' },
  { value: '1M$ or +', label: '1M$ or +' },
  { value: 'None', label: 'None' },
] as const;

export const PLD_PROD_OPTIONS = [
  { value: '3% or +', label: '3% or +' },
  { value: '2% or +', label: '2% or +' },
  { value: '1% or +', label: '1% or +' },
  { value: 'less than 1%', label: 'less than 1%' },
  { value: 'Neg', label: 'Neg' },
] as const;

export const PLD_CERTIFICATION_OPTIONS = [
  { value: 'IATF / ISO9001 (cat BCD)', label: 'IATF / ISO9001 (cat BCD)' },
  { value: 'ISO9001', label: 'ISO9001' },
  { value: 'None', label: 'None' },
] as const;

export const STRATEGIC_MENTION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'strategic', label: 'Strategic' },
  { value: 'monopolistic', label: 'Monopolistic' },
  { value: 'directed', label: 'Directed' },
] as const;

export const PANEL_DECISION_OPTIONS = [
  { value: 'panel_add', label: 'Supplier can be added to the Panel' },
  {
    value: 'panel_add_exec_committee',
    label: 'Supplier can be added to the Panel with Executive Committee Agreement',
  },
  { value: 'panel_reject', label: 'Supplier cannot be added to the Panel' },
] as const;

export const IMPACT_RESULT_OPTIONS = [
  { value: 'Major +', label: 'Major +' },
  { value: 'Minor +', label: 'Minor +' },
  { value: 'Minor -', label: 'Minor -' },
  { value: 'Major -', label: 'Major -' },
  { value: 'None', label: 'None' },
] as const;

export const scoreImpactAnswer = (value?: string): number => {
  const mapping: Record<string, number> = {
    'major +': 5,
    'major -': -5,
    'minor +': 3,
    'minor -': -3,
    none: 0,
  };

  if (!value) {
    return 0;
  }

  return mapping[value.trim().toLowerCase()] ?? 0;
};

export const calculateImpactScore = (answers: Array<string | undefined>): number => {
  return answers.reduce((total, answer) => total + scoreImpactAnswer(answer), 0);
};

export const PRODUCT_TYPES = [
  'Electronics',
  'Chemicals',
  'Metals & Alloys',
  'Plastics',
  'Textiles',
  'Rubber',
  'Glass & Ceramics',
  'Machinery',
  'Raw Materials',
  'Components',
  'Finished Goods',
  'Services',
  'Packaging',
  'Tools & Equipment',
  'Other',
];

export const STEP_CONFIG = [
  { id: 'supplier', label: 'Supplier Info', description: 'Group details' },
  { id: 'unit', label: 'Unit Location', description: 'Manufacturing site' },
  { id: 'contacts', label: 'Contacts', description: 'Primary contact' },
  { id: 'certifications', label: 'Certifications', description: 'Quality certs' },
  { id: 'evaluation', label: 'Evaluation', description: 'Baseline scoring' },
  { id: 'configuration', label: 'Configuration', description: 'Classification' },
  { id: 'review', label: 'Review', description: 'Final review' },
] as const;

/**
 * Validation Utilities
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = (email: string): boolean => {
  return EMAIL_REGEX.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneDigits = phone.replace(/\D/g, '');
  return phoneDigits.length >= 5;
};

export const validateSupplierCode = (code: string): boolean => {
  return /^[A-Z0-9\-]{3,20}$/i.test(code);
};

export const validateURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Formatting Utilities
 */

export const formatCurrency = (amount: number, currency: string): string => {
  return `${amount.toLocaleString()} ${currency}`;
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return 'Not specified';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateShort = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US');
};

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

/**
 * Parsing Utilities
 */

export const parseAmount = (value: string | number): number => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
};

export const parseDate = (value: string | Date): string => {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().split('T')[0];
};

/**
 * Error Message Utilities
 */

export const getErrorMessage = (field: string, error: string): string => {
  const errorMap: { [key: string]: string } = {
    required: `${field} is required`,
    invalid_email: 'Please enter a valid email address',
    invalid_phone: 'Please enter a valid phone number',
    min_length: `${field} must be at least 3 characters`,
    max_length: `${field} must not exceed 100 characters`,
    duplicate: `${field} already exists`,
    invalid_date: 'Please select a valid date',
    future_date: `${field} cannot be in the future`,
  };
  return errorMap[error] || error;
};

/**
 * Array Utilities
 */

export const getCountryOptions = (): Array<{ value: string; label: string }> => {
  return COUNTRIES.map((country) => ({
    value: country,
    label: country,
  }));
};

export const getPldOnboardingOptions = () => ({
  top: PLD_TOP_OPTIONS,
  lta: PLD_LTA_OPTIONS,
  sqma: PLD_SQMA_OPTIONS,
  quality_certification: PLD_CERTIFICATION_OPTIONS,
  family_coverage: PLD_FAMILY_COVERAGE_OPTIONS,
  competitiveness: PLD_COMPETITIVENESS_OPTIONS,
  geo_coverage: PLD_GEO_COVERAGE_OPTIONS,
  cons_or_wd: PLD_CONS_OR_WD_OPTIONS,
  financial_health: PLD_FINANCIAL_HEALTH_OPTIONS,
  prod_lia_ins: PLD_PROD_LIA_INS_OPTIONS,
  prod: PLD_PROD_OPTIONS,
});

export const getCertificationTypeOptions = () => PLD_CERTIFICATION_OPTIONS;

export const getPldOptionLabel = (
  field:
    | 'top'
    | 'lta'
    | 'sqma'
    | 'quality_certification'
    | 'family_coverage'
    | 'competitiveness'
    | 'geo_coverage'
    | 'cons_or_wd'
    | 'financial_health'
    | 'prod_lia_ins'
    | 'prod',
  value?: string,
) => {
  const optionSets = getPldOnboardingOptions();
  const options = optionSets[field];
  return options.find((option) => option.value === value)?.label || value || 'Not specified';
};

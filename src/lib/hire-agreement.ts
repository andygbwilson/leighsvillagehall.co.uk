export const BOOKING_NUMBER_PATTERN = /^[A-Za-z0-9._-]{2,40}$/;

export type YesNo = 'yes' | 'no' | '';

export type PaymentMethod = 'cash' | 'cheque' | 'bank' | 'later' | '';

export type AlcoholSupply = 'sold' | 'free' | '';

export type HireAgreementRecord = {
  bookingNumber: string;
  status: 'draft' | 'submitted';
  stepSaved: 1 | 2;
  updatedAt: string;
  hirerName: string;
  organisation: string;
  position: string;
  address: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  postcode: string;
  telephone: string;
  email: string;
  hireDate: string;
  timeFrom: string;
  timeTo: string;
  functionType: string;
  numberAttending: string;
  chargeAcknowledged: boolean;
  johnWrightHall: YesNo;
  brianPoultneyHall: YesNo;
  kitchen: YesNo;
  stage: YesNo;
  inflatable: YesNo;
  largeTables: string;
  standardChairs: string;
  smallTables: string;
  nurseryTables: string;
  nurseryChairs: string;
  crockery: YesNo;
  entertainment: string;
  musicPlayed: YesNo;
  musicCeaseTime: string;
  alcoholConsumed: YesNo;
  alcoholSupply: AlcoholSupply;
  tenAcknowledged: boolean;
  paymentMethod: PaymentMethod;
  depositDue: string;
  amountPaid: string;
  balanceDue: string;
  publicLiabilityRead: boolean;
  healthSafetyAgreed: boolean;
  conditionsAgreed: boolean;
  signedDate: string;
  mobile: string;
  inviteSentAt?: string;
};

export type HireAgreementPayload = Partial<HireAgreementRecord> & {
  bookingNumber: string;
};

const STRING_FIELDS = [
  'hirerName',
  'organisation',
  'position',
  'address',
  'addressLine1',
  'addressLine2',
  'town',
  'county',
  'postcode',
  'telephone',
  'email',
  'hireDate',
  'timeFrom',
  'timeTo',
  'functionType',
  'numberAttending',
  'largeTables',
  'standardChairs',
  'smallTables',
  'nurseryTables',
  'nurseryChairs',
  'entertainment',
  'musicCeaseTime',
  'signedDate',
  'mobile',
  'depositDue',
  'amountPaid',
  'balanceDue',
] as const;

export const PUBLIC_LOCKED_FIELDS = [
  'hireDate',
  'timeFrom',
  'timeTo',
  'depositDue',
  'amountPaid',
  'balanceDue',
] as const;

const YES_NO_FIELDS = [
  'johnWrightHall',
  'brianPoultneyHall',
  'kitchen',
  'stage',
  'inflatable',
  'crockery',
  'musicPlayed',
  'alcoholConsumed',
] as const;

const BOOL_FIELDS = [
  'chargeAcknowledged',
  'tenAcknowledged',
  'publicLiabilityRead',
  'healthSafetyAgreed',
  'conditionsAgreed',
] as const;

export function emptyHireAgreement(bookingNumber = ''): HireAgreementRecord {
  return {
    bookingNumber,
    status: 'draft',
    stepSaved: 1,
    updatedAt: '',
    hirerName: '',
    organisation: '',
    position: '',
    address: '',
    addressLine1: '',
    addressLine2: '',
    town: '',
    county: '',
    postcode: '',
    telephone: '',
    email: '',
    hireDate: '',
    timeFrom: '',
    timeTo: '',
    functionType: '',
    numberAttending: '',
    chargeAcknowledged: false,
    johnWrightHall: '',
    brianPoultneyHall: '',
    kitchen: '',
    stage: '',
    inflatable: '',
    largeTables: '',
    standardChairs: '',
    smallTables: '',
    nurseryTables: '',
    nurseryChairs: '',
    crockery: '',
    entertainment: '',
    musicPlayed: '',
    musicCeaseTime: '',
    alcoholConsumed: '',
    alcoholSupply: '',
    tenAcknowledged: false,
    paymentMethod: '',
    depositDue: '',
    amountPaid: '',
    balanceDue: '',
    publicLiabilityRead: false,
    healthSafetyAgreed: false,
    conditionsAgreed: false,
    signedDate: '',
    mobile: '',
  };
}

export function isValidBookingNumber(value: string): boolean {
  return BOOKING_NUMBER_PATTERN.test(value.trim());
}

export function bookingStorageKey(bookingNumber: string): string {
  return `booking:${bookingNumber.trim()}`;
}

const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function normalisePostcode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length < 5) return value.trim().toUpperCase();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function isValidUkPostcode(value: string): boolean {
  return UK_POSTCODE_PATTERN.test(value.trim());
}

export function formatAddress(
  record: Pick<HireAgreementRecord, 'addressLine1' | 'addressLine2' | 'town' | 'county' | 'postcode' | 'address'>,
): string {
  const parts = [record.addressLine1, record.addressLine2, record.town, record.county, record.postcode]
    .map((part) => (part ?? '').trim())
    .filter(Boolean);
  return parts.join(', ') || (record.address ?? '').trim();
}

export function splitAddress(raw: string): Pick<
  HireAgreementRecord,
  'addressLine1' | 'addressLine2' | 'town' | 'county' | 'postcode'
> {
  const text = raw.replace(/\r\n/g, '\n').trim();
  const postcodeMatch = text.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\s*$/i);
  const postcode = postcodeMatch ? normalisePostcode(postcodeMatch[0]) : '';
  const rest = postcodeMatch
    ? text.slice(0, text.length - postcodeMatch[0].length).replace(/[,\s]+$/, '')
    : text;
  const parts = rest
    .split(/\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { addressLine1: '', addressLine2: '', town: '', county: '', postcode };
  }
  if (parts.length === 1) {
    return { addressLine1: parts[0], addressLine2: '', town: '', county: '', postcode };
  }
  if (parts.length === 2) {
    return { addressLine1: parts[0], addressLine2: '', town: parts[1], county: '', postcode };
  }
  if (parts.length === 3) {
    return { addressLine1: parts[0], addressLine2: parts[1], town: parts[2], county: '', postcode };
  }
  return {
    addressLine1: parts[0],
    addressLine2: parts.slice(1, -2).join(', '),
    town: parts[parts.length - 2],
    county: parts[parts.length - 1],
    postcode,
  };
}

export function normaliseHireAgreement(record: HireAgreementRecord): HireAgreementRecord {
  const hasStructured = Boolean(
    record.addressLine1?.trim() ||
      record.addressLine2?.trim() ||
      record.town?.trim() ||
      record.county?.trim() ||
      record.postcode?.trim(),
  );
  const structured = hasStructured
    ? {
        addressLine1: record.addressLine1 ?? '',
        addressLine2: record.addressLine2 ?? '',
        town: record.town ?? '',
        county: record.county ?? '',
        postcode: record.postcode ? normalisePostcode(record.postcode) : '',
      }
    : splitAddress(record.address ?? '');
  const next = {
    ...record,
    ...structured,
    depositDue: record.depositDue ?? '',
    amountPaid: record.amountPaid ?? '',
    balanceDue: record.balanceDue ?? '',
  };
  next.address = formatAddress(next);
  return next;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

function asYesNo(value: unknown): YesNo {
  const text = asString(value);
  return text === 'yes' || text === 'no' ? text : '';
}

function asAlcoholSupply(value: unknown): AlcoholSupply {
  const text = asString(value);
  return text === 'sold' || text === 'free' ? text : '';
}

function asPaymentMethod(value: unknown): PaymentMethod {
  const text = asString(value);
  return text === 'cash' || text === 'cheque' || text === 'bank' || text === 'later' ? text : '';
}

export function formatMoney(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const numeric = trimmed.replace(/^£\s*/, '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(numeric)) return trimmed;
  const amount = Number(numeric);
  return `£${amount.toLocaleString('en-GB', {
    minimumFractionDigits: amount % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function omitPublicLockedFields(payload: HireAgreementPayload): HireAgreementPayload {
  const next = { ...payload };
  for (const field of PUBLIC_LOCKED_FIELDS) {
    delete next[field];
  }
  return next;
}

export function parsePayload(input: unknown): HireAgreementPayload {
  if (!input || typeof input !== 'object') {
    throw new Error('The form details were missing.');
  }

  const body = input as Record<string, unknown>;
  const bookingNumber = asString(body.bookingNumber);
  if (!isValidBookingNumber(bookingNumber)) {
    throw new Error('Enter the booking number from your confirmation email.');
  }

  const parsed: HireAgreementPayload = { bookingNumber };

  for (const field of STRING_FIELDS) {
    if (field in body) parsed[field] = asString(body[field]);
  }
  for (const field of YES_NO_FIELDS) {
    if (field in body) parsed[field] = asYesNo(body[field]);
  }
  if ('alcoholSupply' in body) parsed.alcoholSupply = asAlcoholSupply(body.alcoholSupply);
  if ('paymentMethod' in body) parsed.paymentMethod = asPaymentMethod(body.paymentMethod);
  for (const field of BOOL_FIELDS) {
    if (field in body) parsed[field] = asBoolean(body[field]);
  }
  if (parsed.postcode) parsed.postcode = normalisePostcode(parsed.postcode);
  const hasStructuredAddress = Boolean(
    parsed.addressLine1 || parsed.addressLine2 || parsed.town || parsed.county || parsed.postcode,
  );
  if (!hasStructuredAddress && parsed.address) {
    Object.assign(parsed, splitAddress(parsed.address));
  }

  return parsed;
}

export function mergeAgreement(
  existing: HireAgreementRecord | null,
  payload: HireAgreementPayload,
  options: { markSubmitted?: boolean } = {},
): HireAgreementRecord {
  const base = normaliseHireAgreement(existing ?? emptyHireAgreement(payload.bookingNumber));
  const { bookingNumber, ...fields } = payload;
  const markSubmitted = options.markSubmitted !== false;
  return normaliseHireAgreement({
    ...base,
    ...fields,
    bookingNumber,
    stepSaved: 2,
    updatedAt: new Date().toISOString(),
    status: markSubmitted ? 'submitted' : base.status,
  });
}

export type HireAgreementSummary = {
  bookingNumber: string;
  hirerName: string;
  email: string;
  hireDate: string;
  timeFrom: string;
  timeTo: string;
  status: HireAgreementRecord['status'];
  updatedAt: string;
  inviteSentAt: string;
};

export function agreementSummary(record: HireAgreementRecord): HireAgreementSummary {
  return {
    bookingNumber: record.bookingNumber,
    hirerName: record.hirerName,
    email: record.email,
    hireDate: record.hireDate,
    timeFrom: record.timeFrom,
    timeTo: record.timeTo,
    status: record.status,
    updatedAt: record.updatedAt,
    inviteSentAt: record.inviteSentAt ?? '',
  };
}

export function agreementKvMetadata(record: HireAgreementRecord): Record<string, string> {
  const summary = agreementSummary(record);
  return {
    bookingNumber: summary.bookingNumber,
    hirerName: summary.hirerName,
    email: summary.email,
    hireDate: summary.hireDate,
    timeFrom: summary.timeFrom,
    timeTo: summary.timeTo,
    status: summary.status,
    updatedAt: summary.updatedAt,
    inviteSentAt: summary.inviteSentAt,
  };
}

export function sortAgreementSummaries(summaries: HireAgreementSummary[]): HireAgreementSummary[] {
  return [...summaries].sort((a, b) => {
    const date = (b.hireDate || '').localeCompare(a.hireDate || '');
    if (date) return date;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

export function validateAgreement(record: HireAgreementRecord): string[] {
  const errors: string[] = [];
  const need = (value: string, message: string) => {
    if (!value.trim()) errors.push(message);
  };

  need(record.hirerName, 'Enter the hirer’s name.');
  need(record.addressLine1, 'Enter the first line of the address.');
  need(record.town, 'Enter a town or city.');
  need(record.postcode, 'Enter a postcode.');
  if (record.postcode && !isValidUkPostcode(record.postcode)) {
    errors.push('Enter a valid UK postcode.');
  }
  need(record.telephone, 'Enter a telephone number.');
  need(record.email, 'Enter an email address.');
  if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
    errors.push('Enter a valid email address.');
  }
  need(record.hireDate, 'Enter the hire date.');
  need(record.timeFrom, 'Enter the start time, including setting up.');
  need(record.timeTo, 'Enter the finish time, including clearing away.');
  need(record.functionType, 'Describe the type of function.');

  need(record.musicPlayed, 'Say whether music will be played.');
  if (record.musicPlayed === 'yes') {
    need(record.musicCeaseTime, 'Enter the time music will stop. It must not continue after 11pm.');
  }
  need(record.alcoholConsumed, 'Say whether alcohol will be consumed.');
  if (record.alcoholConsumed === 'yes') {
    need(record.alcoholSupply, 'Say whether alcohol will be sold or provided free.');
    if (record.alcoholSupply === 'sold' && !record.tenAcknowledged) {
      errors.push('If alcohol will be sold, confirm you will apply for a Temporary Event Notice.');
    }
  }
  if (!record.conditionsAgreed) {
    errors.push('You must agree to the Conditions of Hire.');
  }
  need(record.signedDate, 'Enter the date you are signing the agreement.');
  need(record.mobile, 'Enter a mobile number.');
  return errors;
}

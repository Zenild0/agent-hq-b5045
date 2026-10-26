// ALL knowledge about IRCTC's page structure lives in this file.
//
// !! These selectors were written from knowledge of IRCTC's Angular site and have NOT been
// !! verified against the live site (it needs a real account + captcha). IRCTC changes its
// !! markup often. The driver is built so that when any selector here stops matching, it
// !! falls back to asking *you* to do that one step by hand and then carries on.
// !! `irctc-assistant demo` rehearses the whole flow against a local mock using these same selectors.

import { CLASSES, QUOTAS } from './constants.js';
import { fromISO, MONTHS } from './dates.js';

const rx = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

export const paths = {
  search: '/nget/train-search',
  trainList: /train-list/i,
  passengers: /psgn|passenger/i,
  review: /review/i,
  payment: /payment|bkgPaymentOptions/i,
  confirm: /bkgConfirm|booking-?confirm|ticketSuccess/i,
};

export const sel = {
  // ---- login: we only OPEN the dialog; the user types everything ----
  loginButton: (p) => p.getByRole('link', { name: /^\s*login\s*$/i }).or(p.locator('a.loginText')).first(),
  loggedInMarker: (p) => p.getByText(/^\s*logout\s*$/i).first(),

  // ---- journey form ----
  origin: (p) => p.locator('#origin input').first(),
  destination: (p) => p.locator('#destination input').first(),
  autocompleteOptions: (p) => p.locator('ul[role="listbox"] li, .ui-autocomplete-items li'),
  dateInput: (p) => p.locator('#jDate input').first(),
  classDropdown: (p) => p.locator('#journeyClass').first(),
  quotaDropdown: (p) => p.locator('#journeyQuota').first(),
  dropdownOption: (p, labelRe) => p.locator('li[role="option"], p-dropdownitem li').filter({ hasText: labelRe }).first(),
  searchButton: (p) => p.getByRole('button', { name: /^\s*search\s*$/i }).or(p.locator('button.search_btn')).first(),
  toast: (p) => p.locator('.ui-toast-message, p-toast .ui-toast-detail, .toast-message').first(),

  // ---- results ----
  trainCard: (p, trainNo) => p.locator('app-train-avl-enq').filter({ hasText: trainNo }).first(),
  classTab: (card, cls) => card.locator('.pre-avl, .class-tab, td, div').filter({ hasText: new RegExp(`\\(${cls}\\)`, 'i') }).first(),
  availabilityCell: (card, iso) => {
    const d = fromISO(iso);
    return card.locator('.avl-cell, .pre-avl, td').filter({ hasText: new RegExp(`\\b0?${d.d}\\s+${MONTHS[d.m - 1]}`, 'i') }).first();
  },
  bookNow: (card) => card.getByRole('button', { name: /book now/i }).first(),

  // ---- passenger page ----
  addPassenger: (p) => p.getByText(/add passenger/i).first(),
  passengerRows: (p) => p.locator('app-passenger, .passenger-row'),
  pName: (row) => row.locator('input[placeholder="Name"]').first(),
  pAge: (row) => row.locator('input[formcontrolname="passengerAge"]').first(),
  pGender: (row) => row.locator('select[formcontrolname="passengerGender"]').first(),
  pBerth: (row) => row.locator('select[formcontrolname="passengerBerthChoice"]').first(),
  mobile: (p) => p.locator('#mobileNumber, input[formcontrolname="mobileNumber"]').first(),
  autoUpgrade: (p) => p.getByLabel(/auto\s*upgrad/i).first(),
  confirmOnly: (p) => p.getByLabel(/book only if.*confirm/i).first(),
  insuranceNo: (p) => p.locator('p-radiobutton, label').filter({ hasText: /^\s*no,?\s*i don't want/i }).or(p.getByLabel(/no,? i don.?t want/i)).first(),
  payUPI: (p) => p.getByText(/bhim\s*\/?\s*upi|pay through upi/i).first(),
  continueButton: (p) => p.getByRole('button', { name: /^\s*continue\s*$/i }).first(),

  // ---- payment options page (we select UPI and click through; the user does the rest) ----
  payAndBook: (p) => p.getByRole('button', { name: /pay\s*&?\s*book/i }).first(),

  // ---- confirmation ----
  confirmText: (p) => p.locator('body'),
};

export const classLabel = (cls) => rx(`(${cls})`); // dropdown shows e.g. "Third AC (3A)"
export const quotaLabel = (q) =>
  ({ GN: /^\s*general\s*$/i, LD: /ladies/i, SS: /lower berth|sr\.?\s*citizen|senior/i })[q] ?? rx(QUOTAS[q]);
export { CLASSES };

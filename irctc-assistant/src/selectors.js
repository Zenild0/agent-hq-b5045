// ALL knowledge about IRCTC's page structure lives in this file.
//
// !! None of these selectors has been run against the live site by this project (it needs a
// !! real account + captcha, and irctc.co.in was not reachable from the environment that wrote
// !! this). IRCTC changes its markup often. The driver is built so that when any selector here
// !! stops matching, it falls back to asking *you* to do that one step by hand and then carries on.
// !! `irctc-assistant demo` rehearses the whole flow against a local mock using these same selectors.
//
// Each entry is tagged with how much we know about it:
//   [corroborated]  the same selector / URL / text appears in public IRCTC automation code whose
//                   authors say it was recorded or checked on the live site in 2026 (sources below).
//                   Still second-hand: confirm it on your first real run.
//   [partial]       the element is corroborated, but some detail (text format, widget type, id) is not.
//   [UNVERIFIED]    written from memory of IRCTC's Angular/PrimeNG site; nothing public confirms it.
//
// Sources checked on 2026-11-22 (public GitHub code, not the live site):
//   S1 nickthelegend/irctc-tatkal-tui  src/irctc_tui/selectors.py   ("verified against the live IRCTC DOM, 24-Jul-2026")
//   S2 Revanth363/irctc-ng-autofill    README.md route table         ("recorded on a live booking", Jul 2026)
//   S3 razzak118/train                 src/irctc.js                  (Playwright, Sep 2026)
//   S4 shivamguys/irctc-cypress-automation  cypress/e2e/irctc.cy.js  (Cypress, passenger form)
//
// SAFETY RULE (enforced by test/units.test.js): nothing in this file may point at the login
// user-ID/password fields, any captcha or OTP input, or the UPI ID / VPA field. The driver only
// ever *clicks* the login link, the "BHIM/UPI" option and "Pay & Book"; the human types the rest.

import { CLASSES, QUOTAS } from './constants.js';
import { fromISO, MONTHS } from './dates.js';

const rx = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

export const paths = {
  search: '/nget/train-search', //                         [corroborated S1 S2 S3]
  trainList: /train-list/i, //                             [corroborated S2: /nget/booking/train-list]
  passengers: /psgn|passenger/i, //                        [corroborated S2: /nget/booking/psgninput]
  review: /review/i, //                                    [corroborated S2: /nget/booking/reviewBooking]
  payment: /payment|bkgPaymentOptions/i, //                [corroborated S2: /nget/payment/bkgPaymentOptions]
  confirm: /bkgConfirm|booking-?confirm|ticketSuccess/i, // [partial: one public script uses /nget/booking-confirm; not in S1/S2]
};

export const sel = {
  // ---- login: we only OPEN the dialog; the user types everything ----
  loginButton: (p) => p.getByRole('link', { name: /^\s*login\s*$/i }).or(p.locator('a.loginText')).first(), // [corroborated S1 S3]
  loggedInMarker: (p) => p.getByText(/^\s*logout\s*$/i).first(), //                                         [corroborated S1]

  // ---- journey form ----
  // [corroborated S1] "#origin input" / p-autocomplete[formcontrolname=origin]; S3 sees aria-label "Enter From station".
  origin: (p) => p.locator('#origin input, p-autocomplete[formcontrolname="origin"] input, input[aria-label*="Enter From station" i]').first(),
  destination: (p) => p.locator('#destination input, p-autocomplete[formcontrolname="destination"] input, input[aria-label*="Enter To station" i]').first(),
  // [partial S1] PrimeNG suggestion items; exact class depends on the PrimeNG version in use.
  autocompleteOptions: (p) => p.locator('ul[role="listbox"] li, .ui-autocomplete-items li, .ui-autocomplete-panel li, .p-autocomplete-item'),
  // [partial S1 S3] the calendar input; S3 says it takes DD/MM/YYYY, which is what the driver types.
  dateInput: (p) => p.locator('#jDate input, p-calendar[formcontrolname="journeyDate"] input, input#jDate').first(),
  // [partial S1] S1 uses id "jClass"; the original "#journeyClass" is kept as a fallback.
  classDropdown: (p) => p.locator('#jClass, #journeyClass, p-dropdown[formcontrolname="journeyClass"]').first(),
  quotaDropdown: (p) => p.locator('#journeyQuota, p-dropdown[formcontrolname="journeyQuota"]').first(), // [corroborated S1]
  // [partial S1] dropdown panel items; label text such as "AC 3 Tier (3A)" is matched only by the "(3A)" part.
  dropdownOption: (p, labelRe) =>
    p.locator('li[role="option"], p-dropdownitem li, .ui-dropdown-items li, .p-dropdown-item').filter({ hasText: labelRe }).first(),
  searchButton: (p) => p.getByRole('button', { name: /^\s*search\s*$/i }).or(p.locator('button.search_btn')).first(), // [corroborated S1 S3 S4]
  toast: (p) => p.locator('.ui-toast-message, p-toast .ui-toast-detail, .toast-message').first(), //                      [partial S3]

  // ---- results ----
  trainCard: (p, trainNo) => p.locator('app-train-avl-enq').filter({ hasText: trainNo }).first(), // [corroborated S1 S2 S3]
  // [partial S1 S3] class boxes are .pre-avl ("Sleeper (SL)"); after the first click they become p-tabmenu tabs.
  // Only class-box-like elements are searched: a generic `div` here would match the card's outer wrapper first.
  classTab: (card, cls) =>
    card.locator('.pre-avl, .ui-tabmenuitem, .class-tab').filter({ hasText: new RegExp(`\\(${cls}\\)`, 'i') }).first(),
  // [partial S1] date cells are "td.link .pre-avl" holding a date <strong>; the "25 Dec" text format is NOT confirmed.
  availabilityCell: (card, iso) => {
    const d = fromISO(iso);
    return card.locator('.avl-cell, td.link .pre-avl, .pre-avl, td').filter({ hasText: new RegExp(`\\b0?${d.d}\\s+${MONTHS[d.m - 1]}`, 'i') }).first();
  },
  bookNow: (card) => card.getByRole('button', { name: /book now/i }).first(), // [corroborated S1]

  // ---- passenger page ----
  addPassenger: (p) => p.getByText(/add passenger/i).first(), //  [corroborated S1]
  passengerRows: (p) => p.locator('app-passenger, .passenger-row'), // [corroborated: app-passenger appears in several public XPaths]
  pName: (row) =>
    row.locator('p-autocomplete[formcontrolname="passengerName"] input, input[formcontrolname="passengerName"], input[placeholder="Name"]').first(), // [corroborated S1]
  pAge: (row) => row.locator('input[formcontrolname="passengerAge"]').first(), //            [corroborated S1 S4]
  // [partial S1 S4] native <select> in S4; S1 also allows a PrimeNG p-dropdown. If it is a p-dropdown,
  // selectOption() fails and the driver hands the passenger step to you.
  pGender: (row) => row.locator('select[formcontrolname="passengerGender"]').first(),
  pBerth: (row) => row.locator('select[formcontrolname="passengerBerthChoice"]').first(),
  mobile: (p) => p.locator('#mobileNumber, input[formcontrolname="mobileNumber"]').first(), // [corroborated S1]
  // [partial S1] S1 gives ids #autoUpgradation / #confirmberths (PrimeNG p-checkbox); label text is UNVERIFIED.
  autoUpgrade: (p) => p.getByLabel(/auto\s*upgrad/i).or(p.locator('input#autoUpgradation, #autoUpgradation input')).first(),
  confirmOnly: (p) => p.getByLabel(/book only if.*confirm/i).or(p.locator('input#confirmberths, #confirmberths input')).first(),
  // [UNVERIFIED] travel-insurance "No" radio. Public code only shows ids like travelInsuranceOpted-N.
  insuranceNo: (p) => p.locator('p-radiobutton, label').filter({ hasText: /^\s*no,?\s*i don't want/i }).or(p.getByLabel(/no,? i don.?t want/i)).first(),
  // [partial S1] "BHIM/UPI" text is on the payment page per S1; on the passenger page the wording is UNVERIFIED.
  payUPI: (p) => p.getByText(/bhim\s*\/?\s*upi|pay through upi/i).first(),
  continueButton: (p) => p.getByRole('button', { name: /^\s*continue\s*$/i }).or(p.locator('#nextButton')).first(), // [corroborated S1]

  // ---- payment options page (we select UPI and click through; the user does the rest) ----
  payAndBook: (p) => p.getByRole('button', { name: /pay\s*&?\s*book/i }).first(), // [corroborated S1: "Pay & Book"]

  // ---- confirmation ----
  confirmText: (p) => p.locator('body'), // PNR is read by regex from the page text; wording [UNVERIFIED]
};

// [partial] dropdown labels: we match only the "(3A)" code, which survives "Third AC" vs "AC 3 Tier" wording.
export const classLabel = (cls) => rx(`(${cls})`);
// [UNVERIFIED] quota option wording.
export const quotaLabel = (q) =>
  ({ GN: /^\s*general\s*$/i, LD: /ladies/i, SS: /lower berth|sr\.?\s*citizen|senior/i })[q] ?? rx(QUOTAS[q]);
export { CLASSES };

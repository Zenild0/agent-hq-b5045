// Everything here is a *rule of the railway system* or a UI vocabulary. If IRCTC
// changes a rule, this is the one place to edit.

export const CLASSES = {
  '1A': 'First AC',
  '2A': 'Second AC',
  '3A': 'Third AC',
  '3E': 'Third AC Economy',
  SL: 'Sleeper',
  CC: 'AC Chair Car',
  EC: 'Executive Chair Car',
  '2S': 'Second Sitting',
  EV: 'Vistadome AC',
};

// Only the ordinary quotas are supported on purpose. Tatkal / Premium Tatkal open
// at different times and are the main target of IRCTC's anti-bot systems.
export const QUOTAS = { GN: 'General', LD: 'Ladies', SS: 'Senior Citizen' };

export const GENDERS = { M: 'Male', F: 'Female', T: 'Transgender' };

export const BERTHS = {
  NP: 'No Preference',
  LB: 'Lower',
  MB: 'Middle',
  UB: 'Upper',
  SL: 'Side Lower',
  SU: 'Side Upper',
};

export const IST_OFFSET_MIN = 330; // India has no DST
export const ARP_DAYS = 60; // advance reservation period -- verify, IRCTC has changed this before
export const OPEN_HOUR_IST = 8; // general quota opens 08:00 IST, ARP days before the journey
export const MAX_PASSENGERS = 6; // per ticket
export const MAX_AHEAD_DAYS = 365;
export const NAME_MAX = 16; // IRCTC passenger-name field limit (soft check)

export const IRCTC_BASE_URL = 'https://www.irctc.co.in';

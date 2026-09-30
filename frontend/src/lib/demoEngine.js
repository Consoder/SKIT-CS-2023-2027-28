// Demo-mode analyzer. Until the backend's POST /api/v1/analyze exists
// (Sprint 3.4) and the trained XGBoost model is served (Sprint 4.4), the
// frontend runs this local stand-in so every screen can be built, tested
// and demoed end-to-end.
//
// It returns EXACTLY the response shape proposed for the backend
// (see docs/FRONTEND_PRD.md §7 and the in-app API Access page):
//   { url, verdict, risk_score, evidence: { ... } }
// so switching Settings → "Live API" needs no UI changes.
//
// - Lexical/host features are computed for real (lib/features.js).
// - The verdict is a transparent rule-based score over those features,
//   NOT the ML model.
// - DNS / WHOIS / IP / VirusTotal / AbuseIPDB values are SIMULATED
//   deterministically from the URL, and flagged `simulated: true` so the
//   UI can label them.

import { extractFeatures, shannonEntropy } from './features';

export const DEMO_ENGINE_VERSION = 'demo-heuristic-1.0';

const BRANDS = [
  'paypal', 'apple', 'google', 'microsoft', 'amazon', 'netflix', 'facebook', 'instagram',
  'whatsapp', 'linkedin', 'dropbox', 'office365', 'outlook', 'adobe', 'coinbase', 'binance',
  'metamask', 'chase', 'wellsfargo', 'bankofamerica', 'hdfc', 'icici', 'sbi', 'paytm', 'phonepe',
];

// Tranco-style allowlist of very popular registrable domains.
const TRUSTED_DOMAINS = new Set([
  'google.com', 'youtube.com', 'github.com', 'microsoft.com', 'wikipedia.org', 'amazon.com',
  'amazon.in', 'apple.com', 'linkedin.com', 'stackoverflow.com', 'python.org', 'react.dev',
  'mozilla.org', 'openai.com', 'anthropic.com', 'claude.ai', 'cloudflare.com', 'paypal.com',
  'netflix.com', 'facebook.com', 'instagram.com', 'whatsapp.com', 'x.com', 'twitter.com',
  'reddit.com', 'npmjs.com', 'virustotal.com', 'abuseipdb.com', 'skit.ac.in', 'gov.in',
  'nic.in', 'office.com', 'live.com', 'outlook.com', 'dropbox.com', 'adobe.com', 'zoom.us',
]);

const PHISH_KEYWORDS = [
  'login', 'signin', 'sign-in', 'logon', 'verify', 'verification', 'account', 'secure',
  'update', 'confirm', 'banking', 'password', 'wallet', 'unlock', 'suspended', 'billing',
  'invoice', 'webscr', 'recover', 'kyc', 'reward', 'gift',
];
const MALWARE_EXTENSIONS = /\.(exe|scr|bat|cmd|msi|apk|jar|vbs|ps1|dll|bin|sh|rar|7z|iso|docm|xlsm|hta|lnk)$/i;
const MALWARE_KEYWORDS = ['download', 'crack', 'keygen', 'setup', 'patch', 'payload', 'free-'];
const REDIRECT_PARAM = /(^|&)(url|redirect|redirect_uri|next|target|dest|destination|continue|goto)=/i;

const LEET = { 0: 'o', 1: 'l', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', $: 's', '@': 'a' };

function deLeet(value) {
  return value.replace(/[0134578$@]/g, (char) => LEET[char] ?? char);
}

// Small deterministic PRNG so the same URL always gets the same simulated intel.
function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Rule-based scoring over the extracted features. Each rule that fires
// becomes an explainable "signal" in the UI ("Why this verdict").
export function scoreFeatures(features, meta) {
  const signals = [];
  const add = (id, label, weight, severity, category, detail) =>
    signals.push({ id, label, weight, severity, category, detail });

  const hostLeet = deLeet(meta.hostname);
  const registrable = meta.registrable;
  const sld = registrable.split('.')[0];
  const lowerUrl = meta.url.toLowerCase();
  const pathAndQuery = `${meta.path} ${meta.query}`.toLowerCase();
  const trusted = TRUSTED_DOMAINS.has(registrable);

  if (features.has_ip_address) {
    add('ip_host', 'Raw IP address used as host', 25, 'high', 'malware',
      `The link points straight at ${meta.hostname} instead of a domain name — common for malware drops and throwaway servers.`);
  }

  // Match on host labels/tokens so short brands ("sbi") don't fire inside
  // unrelated words; longer brands may be glued to other text ("paypalsecure").
  const hostTokens = hostLeet.split(/[.-]/);
  const brand = BRANDS.find((name) =>
    hostTokens.some((token) => token === name || (name.length >= 6 && token.includes(name))),
  );
  if (brand && !trusted && deLeet(sld) !== brand) {
    const typo = meta.hostname !== hostLeet;
    add('brand_impersonation', `Impersonates the "${brand}" brand`, typo ? 36 : 26, 'high', 'phishing',
      typo
        ? `The host uses look-alike characters to spell "${brand}", but the registered domain is ${registrable}.`
        : `"${brand}" appears in the host, but the registered domain is ${registrable}, not the brand's own.`);
  } else if (!trusted) {
    const pathBrand = BRANDS.find((name) => pathAndQuery.includes(name));
    if (pathBrand) {
      add('brand_in_path', `Mentions "${pathBrand}" outside the domain`, 12, 'medium', 'phishing',
        `A brand name in the path of an unrelated domain is a common phishing lure.`);
    }
  }

  const keywordHits = PHISH_KEYWORDS.filter((word) => lowerUrl.includes(word));
  if (keywordHits.length && !trusted) {
    add('phish_keywords', 'Credential-lure keywords', Math.min(24, keywordHits.length * 9), keywordHits.length > 1 ? 'high' : 'medium', 'phishing',
      `Contains ${keywordHits.map((word) => `"${word}"`).join(', ')}.`);
  }

  if (MALWARE_EXTENSIONS.test(meta.path)) {
    const extension = meta.path.split('.').pop();
    add('executable_download', `Direct link to a .${extension} file`, 32, 'high', 'malware',
      'The URL downloads an executable or archive, the classic malware delivery pattern.');
  }
  const malwareHits = MALWARE_KEYWORDS.filter((word) => lowerUrl.includes(word));
  if (malwareHits.length && !trusted) {
    add('malware_keywords', 'Download / cracking keywords', 10, 'medium', 'malware',
      `Contains ${malwareHits.map((word) => `"${word}"`).join(', ')}.`);
  }

  if (features.at_symbol_count > 0) {
    add('at_symbol', '"@" symbol in URL', 20, 'high', 'phishing',
      'Browsers ignore everything before "@", so the visible domain can be a decoy.');
  }
  if (features.has_suspicious_tld) {
    add('suspicious_tld', `Abuse-prone TLD ".${features.tld}"`, 18, 'medium', 'generic',
      'Free or very cheap TLDs are over-represented in phishing and malware feeds.');
  }
  if (features.is_shortener) {
    add('shortener', 'URL shortener hides the destination', 26, 'medium', 'generic',
      'The final destination cannot be seen until the link is followed.');
  }
  if (features.has_punycode) {
    add('punycode', 'Internationalized (punycode) domain', 16, 'high', 'phishing',
      'Unicode look-alike characters can make a domain look like a trusted one.');
  }
  if (!features.has_https) {
    add('no_https', 'No HTTPS', 8, 'low', 'generic', 'Traffic to this URL is not encrypted.');
  }
  if (features.url_length > 120) {
    add('very_long_url', 'Very long URL', 12, 'medium', 'generic', `${features.url_length} characters — long URLs are often used to hide the real host.`);
  } else if (features.url_length > 75) {
    add('long_url', 'Long URL', 6, 'low', 'generic', `${features.url_length} characters.`);
  }
  if (features.num_subdomains >= 3) {
    add('deep_subdomains', 'Deeply nested subdomains', 10, 'medium', 'phishing', `${features.num_subdomains} subdomain levels.`);
  }
  const hostHyphens = (meta.hostname.match(/-/g) ?? []).length;
  if (hostHyphens >= 2) {
    add('hyphenated_host', 'Hyphen-stuffed domain', 8, 'low', 'phishing', `${hostHyphens} hyphens in the host name.`);
  }
  // Algorithmically generated names are long, high-entropy AND hard to
  // pronounce; entropy alone flags ordinary hyphenated domains.
  const nameParts = sld.split('-');
  const dgaLike = nameParts.some((part) => {
    const letters = part.replace(/[^a-z]/g, '');
    const vowelRatio = letters.length ? (letters.match(/[aeiou]/g) ?? []).length / letters.length : 0;
    return part.length >= 10 && shannonEntropy(part) > 3.2 && (vowelRatio < 0.25 || /[bcdfghjklmnpqrstvwxz]{5,}/.test(part));
  });
  if (dgaLike && !features.has_ip_address && !trusted) {
    add('random_domain', 'Random-looking domain', 8, 'medium', 'malware', 'High character entropy, typical of algorithmically generated domains.');
  }
  if (features.has_unusual_port) {
    add('unusual_port', 'Non-standard port', 10, 'medium', 'malware', 'Legitimate sites rarely serve pages on custom ports.');
  }
  if (features.double_slash_in_path || REDIRECT_PARAM.test(meta.query)) {
    add('open_redirect', 'Embedded redirect', 10, 'medium', 'phishing', 'The URL carries another URL — a common way to bounce victims through a trusted site.');
  }
  if (features.has_percent_encoding) {
    add('percent_encoding', 'Percent-encoded characters', 5, 'low', 'generic', 'Encoding can be used to hide keywords from filters.');
  }
  if (features.double_dot_in_path) {
    add('path_traversal', '".." in path', 8, 'medium', 'malware', 'Directory-traversal sequences in the path.');
  }

  let score = signals.reduce((sum, signal) => sum + signal.weight, 0);

  if (trusted) {
    add('trusted_domain', 'Well-known, established domain', -40, 'good', 'trust',
      `${registrable} is on the top-sites allowlist.`);
    score = Math.min(12, Math.max(0, score - 40));
  }

  score = clamp(Math.round(score), 0, 100);

  const categoryPoints = { phishing: 0, malware: 0 };
  for (const signal of signals) {
    if (signal.category in categoryPoints) categoryPoints[signal.category] += signal.weight;
  }

  let verdict = 'benign';
  if (score >= 50 && categoryPoints.phishing >= 15 && categoryPoints.phishing > categoryPoints.malware) {
    verdict = 'phishing';
  } else if (score >= 50 && categoryPoints.malware >= 20) {
    verdict = 'malware';
  } else if (score >= 25) {
    verdict = 'suspicious';
  }

  // Distance from the nearest decision boundary -> pseudo-confidence.
  const boundaries = [25, 50];
  const distance = Math.min(...boundaries.map((b) => Math.abs(score - b)));
  const confidence = clamp(0.62 + distance / 60, 0.55, 0.99);

  signals.sort((a, b) => b.weight - a.weight);
  return { score, verdict, confidence: Number(confidence.toFixed(2)), signals };
}

function simulateIntel(meta, score, verdict) {
  const rand = seededRandom(hashString(meta.hostname));
  const risky = score >= 50;
  const grey = score >= 25 && !risky;
  const day = 86400000;
  // Day-aligned so repeat scans of a URL get identical simulated dates.
  const now = Math.floor(Date.now() / day) * day;

  const ipAddress = meta.isIp
    ? meta.hostname.replace(/^\[|\]$/g, '')
    : `${Math.floor(rand() * 200) + 23}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 253) + 1}`;

  const benignNets = [
    ['AS15169', 'Google LLC', 'United States', 'US'],
    ['AS13335', 'Cloudflare, Inc.', 'United States', 'US'],
    ['AS16509', 'Amazon.com, Inc.', 'India', 'IN'],
    ['AS8075', 'Microsoft Corporation', 'Ireland', 'IE'],
    ['AS54113', 'Fastly, Inc.', 'Germany', 'DE'],
  ];
  const riskyNets = [
    ['AS9009', 'M247 Europe SRL', 'Romania', 'RO'],
    ['AS49505', 'JSC Selectel', 'Russia', 'RU'],
    ['AS202425', 'IP Volume inc', 'Seychelles', 'SC'],
    ['AS53667', 'FranTech Solutions', 'United States', 'US'],
    ['AS13335', 'Cloudflare, Inc.', 'United States', 'US'],
    ['AS4134', 'CHINANET-BACKBONE', 'China', 'CN'],
    ['AS14061', 'DigitalOcean, LLC', 'Netherlands', 'NL'],
  ];
  const [asn, org, country, countryCode] = pick(rand, risky || grey ? riskyNets : benignNets);

  const ageDays = risky
    ? Math.floor(rand() * 60) + 1
    : grey
      ? Math.floor(rand() * 700) + 30
      : Math.floor(rand() * 7000) + 1200;

  const resolvable = risky ? rand() > 0.12 : true;
  const privateIp = /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ipAddress);

  const vtTotal = 94;
  const vtMalicious = risky ? Math.round(((score - 45) / 55) * 22 + rand() * 6) + 2 : grey ? Math.floor(rand() * 3) : 0;
  const vtSuspicious = risky ? Math.floor(rand() * 5) + 1 : grey ? Math.floor(rand() * 3) : 0;
  const vtHarmless = Math.max(0, Math.round((vtTotal - vtMalicious - vtSuspicious) * (0.62 + rand() * 0.1)));

  return {
    dns: {
      simulated: true,
      is_resolvable: resolvable,
      has_a_record: resolvable,
      has_aaaa_record: resolvable && rand() > 0.5,
      has_mx_record: risky ? rand() > 0.7 : rand() > 0.2,
      ip_address: resolvable ? ipAddress : '',
      resolves_to_private_ip: privateIp,
      nameservers: risky
        ? [`ns1.${pick(rand, ['freenom.com', 'njalla.no', 'dnspod.net', 'cloudflare.com'])}`]
        : [`ns1.${pick(rand, ['cloudflare.com', 'google.com', 'awsdns-12.org', 'azure-dns.com'])}`],
    },
    ip: {
      simulated: true,
      address: ipAddress,
      asn,
      org,
      country,
      country_code: countryCode,
    },
    whois: meta.isIp
      ? { simulated: true, available: false }
      : {
          simulated: true,
          available: true,
          registrar: risky || grey
            ? pick(rand, ['NameSilo, LLC', 'Namecheap, Inc.', 'Hostinger Operations', 'PDR Ltd.', 'Freenom'])
            : pick(rand, ['MarkMonitor Inc.', 'CSC Corporate Domains', 'GoDaddy.com, LLC', 'Google Domains']),
          created_at: new Date(now - ageDays * day).toISOString(),
          domain_age_days: ageDays,
          expires_at: new Date(now + (risky ? 365 - ageDays : 400 + rand() * 1500) * day).toISOString(),
          privacy_protected: risky || grey ? rand() > 0.2 : rand() > 0.7,
        },
    ssl: {
      simulated: true,
      enabled: meta.url.startsWith('https:'),
      valid: meta.url.startsWith('https:') && (risky ? rand() > 0.3 : true),
      issuer: meta.url.startsWith('https:')
        ? risky || grey
          ? "Let's Encrypt (R11)"
          : pick(rand, ['DigiCert Global G2', 'Google Trust Services', 'Sectigo RSA', 'Amazon RSA 2048'])
        : null,
    },
    threat_intel: {
      simulated: true,
      virustotal: {
        malicious: vtMalicious,
        suspicious: vtSuspicious,
        harmless: vtHarmless,
        undetected: vtTotal - vtMalicious - vtSuspicious - vtHarmless,
        total: vtTotal,
      },
      abuseipdb: {
        abuse_confidence_score: risky ? Math.round(45 + rand() * 50) : grey ? Math.round(rand() * 35) : Math.round(rand() * 4),
        total_reports: risky ? Math.floor(rand() * 300) + 12 : grey ? Math.floor(rand() * 10) : 0,
        last_reported_at: risky ? new Date(now - Math.floor(rand() * 5) * day).toISOString() : null,
      },
      safe_browsing: {
        status: verdict === 'phishing' || verdict === 'malware' ? (rand() > 0.35 ? 'unsafe' : 'unknown') : 'safe',
        threat_type: verdict === 'phishing' ? 'SOCIAL_ENGINEERING' : verdict === 'malware' ? 'MALWARE' : null,
      },
    },
  };
}

// Mirrors POST /api/v1/analyze. Throws for unparseable input like the API's 422.
export function demoAnalyze(url) {
  const started = performance.now();
  const extracted = extractFeatures(url);
  if (!extracted) {
    const error = new Error('url must contain a valid hostname');
    error.code = 'validation_error';
    throw error;
  }

  const { raw: features, meta } = extracted;
  const { score, verdict, confidence, signals } = scoreFeatures(features, meta);
  const intel = simulateIntel(meta, score, verdict);

  return {
    url: meta.url,
    verdict,
    risk_score: score,
    evidence: {
      analyzed_at: new Date().toISOString(),
      duration_ms: Math.round(performance.now() - started),
      confidence,
      model: { name: 'Rule-based demo engine', version: DEMO_ENGINE_VERSION, simulated: true },
      host: { hostname: meta.hostname, registrable_domain: meta.registrable, subdomains: meta.subdomains },
      features,
      signals,
      ...intel,
    },
  };
}

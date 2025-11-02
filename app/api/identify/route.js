import { NextResponse } from 'next/server';

/**
 * Visitor Identification API
 * Attempts to identify anonymous visitors using multiple methods
 */

export async function POST(request) {
  try {
    const { visitor_id, ip_address, referrer, utm_params } = await request.json();

    const identificationData = {
      visitor_id,
      methods_attempted: [],
      identified: false,
      confidence: 0,
      email: null,
      name: null,
      company: null,
      source: null,
      vpn_detected: false
    };

    // Check if visitor is using VPN/proxy (skip expensive IP lookups)
    const isVPN = await detectVPN(ip_address);
    if (isVPN) {
      identificationData.vpn_detected = true;
      console.log(`🔒 VPN detected for ${visitor_id} - skipping IP-based identification`);
    }

    // Method 1: Check if coming from email link with tracking params
    if (utm_params?.utm_medium === 'email' && utm_params?.utm_content) {
      const emailFromParams = decodeEmailFromUTM(utm_params.utm_content);
      if (emailFromParams) {
        identificationData.identified = true;
        identificationData.email = emailFromParams;
        identificationData.source = 'email_tracking_param';
        identificationData.confidence = 95;
        identificationData.methods_attempted.push('utm_param_decode');
      }
    }

    // Method 2: IP Address Lookup (skip if VPN detected - saves API calls)
    if (ip_address && !identificationData.identified && !isVPN) {
      identificationData.methods_attempted.push('ip_lookup');
      const companyData = await reverseIPLookup(ip_address);
      if (companyData) {
        identificationData.identified = true;
        identificationData.company = companyData.company_name;
        identificationData.email = companyData.generic_email; // info@company.com
        identificationData.source = 'ip_reverse_lookup';
        identificationData.confidence = 70;
      }
    }

    // Method 3: Check referrer for email domains
    if (referrer && !identificationData.identified) {
      identificationData.methods_attempted.push('referrer_analysis');
      const emailFromReferrer = extractEmailFromReferrer(referrer);
      if (emailFromReferrer) {
        identificationData.identified = true;
        identificationData.email = emailFromReferrer;
        identificationData.source = 'referrer_extraction';
        identificationData.confidence = 60;
      }
    }

    // Method 4: People Data Labs (skip if VPN - saves $0.03/call)
    if (!identificationData.identified && !isVPN && process.env.PDL_API_KEY) {
      identificationData.methods_attempted.push('people_data_labs');
      const pdlData = await peopleDataLabsLookup(ip_address);
      if (pdlData) {
        identificationData.identified = true;
        identificationData.email = pdlData.email;
        identificationData.name = pdlData.name;
        identificationData.company = pdlData.company;
        identificationData.source = 'people_data_labs';
        identificationData.confidence = 90;
        identificationData.additional_data = pdlData.additional;
      }
    }

    // Method 5: Clearbit (skip if VPN - saves API quota)
    if (!identificationData.identified && !isVPN && process.env.CLEARBIT_API_KEY) {
      identificationData.methods_attempted.push('clearbit_reveal');
      const clearbitData = await clearbitReveal(ip_address);
      if (clearbitData) {
        identificationData.identified = true;
        identificationData.email = clearbitData.email;
        identificationData.name = clearbitData.name;
        identificationData.company = clearbitData.company;
        identificationData.source = 'clearbit_reveal';
        identificationData.confidence = 85;
      }
    }

    // Note: If VPN detected, rely on other methods (forms, UTM params, browser fingerprinting)
    if (isVPN && !identificationData.identified) {
      console.log(`ℹ️  VPN user - will identify via form submission or email tracking`);
    }

    console.log(`🔍 Identification attempt for ${visitor_id}:`,
      identificationData.identified ? `✅ Found via ${identificationData.source}` : '❌ Not identified');

    return NextResponse.json({
      success: true,
      ...identificationData
    });

  } catch (error) {
    console.error('Identification error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Decode email from UTM tracking parameter
function decodeEmailFromUTM(utmContent) {
  try {
    // Common pattern: utm_content=email_john@example.com
    const match = utmContent.match(/email[_-]([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Extract email from referrer URL
function extractEmailFromReferrer(referrer) {
  try {
    // Some email clients include the email in the referrer
    const url = new URL(referrer);
    const emailMatch = url.searchParams.get('email') ||
                       url.searchParams.get('user') ||
                       url.searchParams.get('recipient');

    if (emailMatch && emailMatch.includes('@')) {
      return emailMatch;
    }
    return null;
  } catch {
    return null;
  }
}

// Reverse IP lookup to identify company (B2B)
async function reverseIPLookup(ipAddress) {
  // In production, use services like:
  // - IPinfo.io
  // - IP2Location
  // - MaxMind GeoIP

  // Demo mode - simulate company lookup
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔍 [DEMO] Would lookup IP: ${ipAddress}`);

    // Simulate finding a company for certain IPs
    if (ipAddress.startsWith('192.168') || ipAddress.startsWith('10.')) {
      return null; // Local network
    }

    // Demo: Return fake company data 10% of the time
    if (Math.random() < 0.1) {
      return {
        company_name: 'Demo Company Inc',
        generic_email: 'contact@democompany.com',
        industry: 'Technology',
        employee_count: '50-200'
      };
    }
  }

  // Real implementation:
  /*
  if (process.env.IPINFO_API_KEY) {
    const response = await fetch(`https://ipinfo.io/${ipAddress}/json?token=${process.env.IPINFO_API_KEY}`);
    const data = await response.json();

    if (data.company) {
      return {
        company_name: data.company.name,
        generic_email: `info@${data.company.domain}`,
        industry: data.company.type,
        employee_count: data.company.size
      };
    }
  }
  */

  return null;
}

// People Data Labs - Best for B2B identification
async function peopleDataLabsLookup(ipAddress) {
  if (!process.env.PDL_API_KEY) {
    return null;
  }

  try {
    // PDL IP Enrichment API
    // Docs: https://docs.peopledatalabs.com/docs/ip-enrichment-api
    const response = await fetch(`https://api.peopledatalabs.com/v5/ip/enrich?ip=${ipAddress}`, {
      headers: {
        'X-Api-Key': process.env.PDL_API_KEY
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status === 200 && data.data) {
      const person = data.data;

      return {
        email: person.emails?.[0]?.address || person.work_email,
        name: person.full_name,
        company: person.job_company_name,
        domain: person.job_company_website,
        title: person.job_title,
        additional: {
          linkedin: person.linkedin_url,
          phone: person.phone_numbers?.[0],
          location: person.location_name,
          industry: person.industry,
          seniority: person.job_title_levels?.[0]
        }
      };
    }

    return null;

  } catch (error) {
    console.error('People Data Labs error:', error);
    return null;
  }
}

// Clearbit Reveal - Identify visitor by IP
async function clearbitReveal(ipAddress) {
  if (!process.env.CLEARBIT_API_KEY) {
    return null;
  }

  try {
    // Clearbit Reveal API
    // https://clearbit.com/docs#reveal-api
    const response = await fetch(`https://reveal.clearbit.com/v1/companies/find?ip=${ipAddress}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLEARBIT_API_KEY}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      email: data.email || `info@${data.domain}`,
      name: data.name,
      company: data.name,
      domain: data.domain,
      industry: data.category?.industry,
      employee_count: data.metrics?.employees
    };

  } catch (error) {
    console.error('Clearbit Reveal error:', error);
    return null;
  }
}

// Additional helper: FullContact enrichment
async function fullContactEnrich(email) {
  if (!process.env.FULLCONTACT_API_KEY) {
    return null;
  }

  try {
    const response = await fetch('https://api.fullcontact.com/v3/person.enrich', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FULLCONTACT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      name: data.fullName,
      company: data.organization,
      title: data.title,
      location: data.location,
      social_profiles: data.socialProfiles
    };

  } catch (error) {
    console.error('FullContact error:', error);
    return null;
  }
}

// Detect VPN/Proxy usage
async function detectVPN(ipAddress) {
  if (!ipAddress) return false;

  // Common VPN/Proxy IP ranges (basic detection)
  const vpnIndicators = [
    // Local/private IPs
    ipAddress.startsWith('127.'),
    ipAddress.startsWith('10.'),
    ipAddress.startsWith('192.168.'),
    ipAddress.startsWith('172.16.'),
    // Common VPN providers
    ipAddress.includes('vpn'),
    ipAddress.includes('proxy')
  ];

  if (vpnIndicators.some(indicator => indicator)) {
    return true;
  }

  // For production: Use a VPN detection service
  // Options:
  // 1. IPQualityScore: https://www.ipqualityscore.com/
  // 2. IPHub: https://iphub.info/
  // 3. VPN Blocker: https://vpnblocker.net/

  /*
  // Example with IPHub (requires API key)
  if (process.env.IPHUB_API_KEY) {
    try {
      const response = await fetch(`https://v2.api.iphub.info/ip/${ipAddress}`, {
        headers: { 'X-Key': process.env.IPHUB_API_KEY }
      });
      const data = await response.json();
      // block: 0 = residential, 1 = VPN/proxy, 2 = datacenter
      return data.block === 1;
    } catch {
      return false;
    }
  }
  */

  return false;
}

import { NextResponse } from 'next/server';
import { getStore } from '@netlify/blobs';

// Get blob store
function getBlobStore() {
  return getStore('attrios-tracking');
}

// Load all tracking data from Netlify Blobs
async function loadAllData() {
  try {
    const store = getBlobStore();

    const [eventsData, visitorsData, sessionsData, campaignsData, triggersData] = await Promise.all([
      store.get('events'),
      store.get('visitors'),
      store.get('sessions'),
      store.get('campaigns'),
      store.get('triggers')
    ]);

    const events = eventsData ? JSON.parse(eventsData) : [];

    const visitorsArray = visitorsData ? JSON.parse(visitorsData) : [];
    const visitors = new Map(visitorsArray.map(v => [v.id, {
      ...v,
      sessions: new Set(v.sessions)
    }]));

    const sessionsArray = sessionsData ? JSON.parse(sessionsData) : [];
    const sessions = new Map(sessionsArray.map(s => [s.id, {
      ...s,
      pages_viewed: new Set(s.pages_viewed)
    }]));

    const campaigns = campaignsData ? JSON.parse(campaignsData) : [];
    const firedTriggers = new Set(triggersData ? JSON.parse(triggersData) : []);

    return { events, visitors, sessions, campaigns, firedTriggers };
  } catch (error) {
    console.error('❌ Error loading from Netlify Blobs:', error);
    return {
      events: [],
      visitors: new Map(),
      sessions: new Map(),
      campaigns: [],
      firedTriggers: new Set()
    };
  }
}

// Save all tracking data to Netlify Blobs
async function saveAllData(events, visitors, sessions, campaigns, firedTriggers) {
  try {
    const store = getBlobStore();

    // Convert Maps and Sets to arrays for storage
    const visitorsArray = Array.from(visitors.values()).map(v => ({
      ...v,
      sessions: Array.from(v.sessions)
    }));

    const sessionsArray = Array.from(sessions.values()).map(s => ({
      ...s,
      pages_viewed: Array.from(s.pages_viewed)
    }));

    const triggersArray = Array.from(firedTriggers);

    // Save all data in parallel
    await Promise.all([
      store.set('events', JSON.stringify(events)),
      store.set('visitors', JSON.stringify(visitorsArray)),
      store.set('sessions', JSON.stringify(sessionsArray)),
      store.set('campaigns', JSON.stringify(campaigns)),
      store.set('triggers', JSON.stringify(triggersArray))
    ]);

    console.log(`✅ Saved to Netlify Blobs: ${visitors.size} visitors`);
  } catch (error) {
    console.error('❌ Error saving to Netlify Blobs:', error);
  }
}

// Enrich visitor with People Data Labs - IP Enrichment API
async function enrichVisitorWithPDL(visitorId, ipAddress) {
  if (!process.env.PDL_API_KEY) {
    console.log('⚠️  No PDL API key - skipping enrichment');
    return { status: 'no_api_key', data: null };
  }

  try {
    console.log(`🔍 Enriching visitor ${visitorId} with PDL IP Enrichment (IP: ${ipAddress})`);

    // Use PDL IP Enrichment API - identifies companies from business IPs
    const response = await fetch(`https://api.peopledatalabs.com/v5/ip/enrich?ip=${encodeURIComponent(ipAddress)}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.PDL_API_KEY
      }
    });

    if (response.status === 404) {
      // No company found - likely a residential/consumer IP
      console.log(`ℹ️  PDL: No company found for IP ${ipAddress} (likely residential)`);
      return { status: 'no_match', statusCode: 404, data: null };
    }

    if (!response.ok) {
      console.log(`⚠️  PDL API error: ${response.status}`);
      return { status: 'error', statusCode: response.status, data: null };
    }

    const result = await response.json();

    // Extract company and person data from IP enrichment
    if (result.status === 200 && result.data) {
      const data = result.data;
      const company = data.company || {};
      const person = data.person || null;

      const enrichedData = {
        // Company info from IP
        company_name: company.name || null,
        company_website: company.website || null,
        company_industry: company.industry || null,
        company_size: company.size || null,
        company_location: company.location || null,

        // Person info if available (PDL sometimes includes likely person)
        full_name: person?.full_name || null,
        first_name: person?.first_name || null,
        last_name: person?.last_name || null,
        emails: person?.emails || [],
        phone_numbers: person?.phone_numbers || [],
        job_title: person?.job_title || null,
        linkedin_url: person?.linkedin_url || null,

        // IP metadata
        ip_location: data.ip?.location || null,
        ip_type: data.ip?.type || null, // business, residential, mobile, etc

        pdl_id: person?.id || null
      };

      const hasPersonData = person && person.full_name;
      console.log(`✅ PDL enriched IP ${ipAddress}: Company=${company.name || 'None'}, Person=${hasPersonData ? person.full_name : 'None'}`);

      return {
        status: hasPersonData ? 'match_found' : 'company_only',
        data: enrichedData
      };
    }

    console.log('⚠️  PDL: Unexpected response format');
    return { status: 'no_match', statusCode: response.status, data: null };
  } catch (error) {
    console.error('❌ PDL enrichment error:', error.message);
    return { status: 'error', error: error.message, data: null };
  }
}

export async function POST(request) {
  try {
    // Load all data
    const { events, visitors, sessions, campaigns, firedTriggers } = await loadAllData();

    // Find all visitors with pending PDL status
    const pendingVisitors = Array.from(visitors.values()).filter(v =>
      v.pdl_status === 'pending' && v.ip_address
    );

    console.log(`🔄 Found ${pendingVisitors.length} visitors with pending PDL status`);

    const results = {
      total: pendingVisitors.length,
      processed: 0,
      match_found: 0,
      no_match: 0,
      error: 0,
      details: []
    };

    // Enrich each visitor
    for (const visitor of pendingVisitors) {
      console.log(`Processing visitor ${visitor.id}...`);

      const result = await enrichVisitorWithPDL(visitor.id, visitor.ip_address);

      // Update visitor with PDL result
      visitor.pdl_status = result.status;
      visitor.pdl_response_code = result.statusCode;
      visitor.pdl_attempted_at = new Date().toISOString();

      if ((result.status === 'match_found' || result.status === 'company_only') && result.data) {
        // Person data
        if (result.data.full_name) {
          visitor.email = result.data.emails?.[0] || visitor.email;
          visitor.name = result.data.full_name || visitor.name;
          visitor.phone = result.data.phone_numbers?.[0] || visitor.phone;
          visitor.job_title = result.data.job_title;
          visitor.linkedin = result.data.linkedin_url;
        }

        // Company data
        if (result.data.company_name) {
          visitor.company = result.data.company_name;
          visitor.company_website = result.data.company_website;
          visitor.company_industry = result.data.company_industry;
        }

        visitor.pdl_data = result.data;
        if (result.status === 'match_found') {
          results.match_found++;
        } else {
          results.company_only = (results.company_only || 0) + 1;
        }
      } else if (result.status === 'no_match') {
        results.no_match++;
      } else if (result.status === 'error') {
        results.error++;
      }

      results.processed++;
      results.details.push({
        visitor_id: visitor.id,
        ip: visitor.ip_address,
        status: result.status,
        name: result.data?.full_name || null
      });

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Save updated data
    await saveAllData(events, visitors, sessions, campaigns, firedTriggers);

    console.log(`✅ Backfill complete: ${results.match_found} matches, ${results.no_match} no matches, ${results.error} errors`);

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('❌ Backfill error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

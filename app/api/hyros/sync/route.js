import { NextResponse } from 'next/server';
import { getStore } from '@netlify/blobs';

// Get blob store
function getBlobStore() {
  return getStore('attrios-tracking');
}

// Load tracking data
async function loadAllData() {
  try {
    const store = getBlobStore();
    const visitorsData = await store.get('visitors');

    const visitorsArray = visitorsData ? JSON.parse(visitorsData) : [];
    const visitors = new Map(visitorsArray.map(v => [v.id, {
      ...v,
      sessions: new Set(v.sessions)
    }]));

    return visitors;
  } catch (error) {
    console.error('Error loading data:', error);
    return new Map();
  }
}

// Fetch leads from Hyros API
async function fetchHyrosLeads(apiKey) {
  try {
    // Hyros API endpoint for leads
    const response = await fetch('https://api.hyros.com/v1/api/v1.0/leads', {
      method: 'GET',
      headers: {
        'API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Hyros API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Hyros API fetch error:', error);
    throw error;
  }
}

// Match Hyros leads with Attrios visitors
function matchHyrosLeads(hyrosLeads, attriosVisitors) {
  const matched = [];
  const unmatched = [];

  for (const lead of hyrosLeads) {
    // Try to match by email, IP, or timestamp
    let matchedVisitor = null;

    if (lead.email) {
      // Find visitor with same email
      matchedVisitor = Array.from(attriosVisitors.values()).find(v => v.email === lead.email);
    }

    if (!matchedVisitor && lead.ip_address) {
      // Try matching by IP and approximate timestamp
      matchedVisitor = Array.from(attriosVisitors.values()).find(v => {
        if (v.ip_address !== lead.ip_address) return false;

        // Check if timestamps are within 5 minutes
        if (lead.created_at && v.first_seen) {
          const leadTime = new Date(lead.created_at).getTime();
          const visitorTime = new Date(v.first_seen).getTime();
          const diffMinutes = Math.abs(leadTime - visitorTime) / 60000;
          return diffMinutes < 5;
        }

        return false;
      });
    }

    if (matchedVisitor) {
      matched.push({
        hyros_lead: lead,
        attrios_visitor: matchedVisitor,
        match_method: lead.email ? 'email' : 'ip_timestamp'
      });
    } else {
      unmatched.push(lead);
    }
  }

  return { matched, unmatched };
}

export async function GET(request) {
  try {
    // Check for API key
    if (!process.env.HYROS_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'HYROS_API_KEY not configured'
      }, { status: 500 });
    }

    // Fetch Hyros leads
    console.log('🔄 Syncing Hyros leads...');
    const hyrosLeads = await fetchHyrosLeads(process.env.HYROS_API_KEY);

    // Load Attrios visitors
    const attriosVisitors = await loadAllData();

    // Match them
    const { matched, unmatched } = matchHyrosLeads(hyrosLeads, attriosVisitors);

    console.log(`✅ Hyros sync complete: ${matched.length} matched, ${unmatched.length} unmatched`);

    return NextResponse.json({
      success: true,
      stats: {
        total_hyros_leads: hyrosLeads.length,
        matched_visitors: matched.length,
        hyros_only: unmatched.length,
        attrios_visitors: attriosVisitors.size
      },
      matched,
      hyros_only: unmatched
    });

  } catch (error) {
    console.error('Hyros sync error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST endpoint to manually trigger sync
export async function POST(request) {
  return GET(request);
}

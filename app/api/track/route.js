import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStore } from '@netlify/blobs';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

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

    console.log(`✅ Loaded from Netlify Blobs: ${events.length} events, ${visitors.size} visitors, ${sessions.size} sessions`);

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

    console.log(`✅ Saved to Netlify Blobs: ${events.length} events, ${visitors.size} visitors`);
  } catch (error) {
    console.error('❌ Error saving to Netlify Blobs:', error);
  }
}

// Enrich visitor with People Data Labs
async function enrichVisitorWithPDL(visitorId, ipAddress) {
  if (!process.env.PDL_API_KEY) {
    console.log('⚠️  No PDL API key - skipping enrichment');
    return { status: 'no_api_key', data: null };
  }

  try {
    console.log(`🔍 Enriching visitor ${visitorId} with PDL (IP: ${ipAddress})`);

    // Use PDL Person Search API with IP parameter
    const response = await fetch('https://api.peopledatalabs.com/v5/person/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.PDL_API_KEY
      },
      body: JSON.stringify({
        query: {
          ip_address: ipAddress
        },
        size: 1
      })
    });

    if (!response.ok) {
      console.log(`⚠️  PDL API error: ${response.status}`);
      return { status: 'error', statusCode: response.status, data: null };
    }

    const result = await response.json();

    // Search API returns data in result.data array
    if (result.status === 200 && result.data && result.data.length > 0) {
      const person = result.data[0]; // Get first match
      const enrichedData = {
        full_name: person.full_name,
        first_name: person.first_name,
        last_name: person.last_name,
        emails: person.emails || [],
        phone_numbers: person.phone_numbers || [],
        mobile_phone: person.mobile_phone,
        job_title: person.job_title,
        job_company_name: person.job_company_name,
        linkedin_url: person.linkedin_url,
        location_name: person.location_name,
        pdl_id: person.id,
        likelihood: person.likelihood || 0
      };

      console.log(`✅ PDL enriched: ${enrichedData.full_name || 'Unknown'} (${enrichedData.emails?.[0] || 'No email'}) - Likelihood: ${enrichedData.likelihood}`);
      return { status: 'match_found', data: enrichedData };
    }

    console.log('⚠️  PDL: No data found for this IP');
    return { status: 'no_match', statusCode: result.status, data: null };
  } catch (error) {
    console.error('❌ PDL enrichment error:', error.message);
    return { status: 'error', error: error.message, data: null };
  }
}

export async function POST(request) {
  try {
    const data = await request.json();

    // Load tracking data from Netlify Blobs
    const { events, visitors, sessions, campaigns, firedTriggers } = await loadAllData();

    // Get IP address from request
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      '0.0.0.0';

    // Store event
    const event = {
      ...data,
      server_timestamp: new Date().toISOString(),
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ip_address: ipAddress
    };

    events.push(event);

    // Update visitor profile
    const visitorId = data.visitor_id;
    const isNewVisitor = !visitors.has(visitorId);

    if (isNewVisitor) {
      visitors.set(visitorId, {
        id: visitorId,
        first_seen: event.timestamp,
        events: [],
        sessions: new Set(),
        email: null,
        name: null,
        phone: null,
        client_id: data.client_id,
        ip_address: ipAddress,
        pdl_status: 'pending',
        pdl_attempted_at: new Date().toISOString()
      });

      // Enrich visitor with People Data Labs (async, don't wait)
      enrichVisitorWithPDL(visitorId, ipAddress).then(async (result) => {
        // Reload data to get latest state
        const { events: latestEvents, visitors: latestVisitors, sessions: latestSessions, campaigns: latestCampaigns, firedTriggers: latestTriggers } = await loadAllData();

        const visitor = latestVisitors.get(visitorId);
        if (visitor) {
          visitor.pdl_status = result.status;
          visitor.pdl_response_code = result.statusCode;

          if (result.status === 'match_found' && result.data) {
            visitor.email = result.data.emails?.[0] || visitor.email;
            visitor.name = result.data.full_name || visitor.name;
            visitor.phone = result.data.phone_numbers?.[0] || visitor.phone;
            visitor.job_title = result.data.job_title;
            visitor.company = result.data.job_company_name;
            visitor.linkedin = result.data.linkedin_url;
            visitor.location = result.data.location_name;
            visitor.pdl_data = result.data;
            console.log(`✅ Visitor ${visitorId} enriched with PDL data`);
          } else {
            console.log(`ℹ️  Visitor ${visitorId} PDL status: ${result.status}`);
          }

          // Save updated visitor data back to Netlify Blobs
          await saveAllData(latestEvents, latestVisitors, latestSessions, latestCampaigns, latestTriggers);
        }
      }).catch(err => {
        console.error('PDL enrichment error:', err);
      });
    }

    const visitor = visitors.get(visitorId);

    // Log new visitor to context
    if (isNewVisitor && data.client_id) {
      logVisitorActivity(data.client_id, visitor, event, 'new_visitor');
    }
    visitor.events.push(event.id);
    visitor.sessions.add(data.session_id);
    visitor.last_seen = event.timestamp;

    // Capture user data if provided
    const previousEmail = visitor.email;
    if (data.event_type === 'identify' && data.user_data) {
      visitor.email = data.user_data.email || visitor.email;
      visitor.name = data.user_data.name || visitor.name;
      visitor.phone = data.user_data.phone || visitor.phone;

      // Log email capture to context
      if (!previousEmail && visitor.email && data.client_id) {
        logVisitorActivity(data.client_id, visitor, event, 'email_captured');
      }
    }

    // Capture form data
    if (data.event_type === 'form_submit' && data.captured_data) {
      visitor.email = data.captured_data.email || visitor.email;
      visitor.name = data.captured_data.name || visitor.name;
      visitor.phone = data.captured_data.phone || visitor.phone;

      // Log form submission to context
      if (data.client_id) {
        logVisitorActivity(data.client_id, visitor, event, 'form_submit');
      }

      // Also log email capture if this is first time getting email
      if (!previousEmail && visitor.email && data.client_id) {
        logVisitorActivity(data.client_id, visitor, event, 'email_captured');
      }
    }

    // Update session
    const sessionId = data.session_id;
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        id: sessionId,
        visitor_id: visitorId,
        client_id: data.client_id, // Add client_id for filtering
        started: event.timestamp,
        events: [],
        pages_viewed: new Set(),
        max_scroll: 0,
        time_on_site: 0
      });
    }

    const session = sessions.get(sessionId);
    session.events.push(event.id);
    session.last_activity = event.timestamp;

    if (data.page) {
      session.pages_viewed.add(data.page.url);
    }

    if (data.event_type === 'scroll') {
      session.max_scroll = Math.max(session.max_scroll, data.depth || 0);
    }

    if (data.event_type === 'time_on_page') {
      session.time_on_site = data.seconds || 0;
    }

    // Check for triggers (e.g., abandoned cart, high engagement, etc.)
    await checkTriggers(visitor, session, event, events, visitors, sessions, campaigns, firedTriggers);

    // Save all data to Netlify Blobs after processing
    await saveAllData(events, visitors, sessions, campaigns, firedTriggers);

    return NextResponse.json({
      success: true,
      event_id: event.id
    });

  } catch (error) {
    console.error('Tracking error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request) {
  // Load tracking data from Netlify Blobs
  const { events, visitors, sessions, campaigns } = await loadAllData();

  // Get client_id from query params (for user-specific dashboards)
  const { searchParams } = new URL(request.url);
  const clientIdFilter = searchParams.get('client_id');

  // Filter events by client_id if provided
  const filteredEvents = clientIdFilter
    ? events.filter(e => e.client_id === clientIdFilter)
    : events;

  // Filter visitors by client_id
  const filteredVisitors = clientIdFilter
    ? new Map(Array.from(visitors.entries()).filter(([_, v]) => v.client_id === clientIdFilter))
    : visitors;

  // Filter sessions by client_id
  const filteredSessions = clientIdFilter
    ? new Map(Array.from(sessions.entries()).filter(([_, s]) => s.client_id === clientIdFilter))
    : sessions;

  // Filter campaigns by client_id
  const filteredCampaigns = clientIdFilter
    ? campaigns.filter(c => c.client_id === clientIdFilter)
    : campaigns;

  // Build detailed visitor profiles
  const detailedVisitors = Array.from(filteredVisitors.values()).map(visitor => {
    const visitorEvents = filteredEvents.filter(e => e.visitor_id === visitor.id);
    const visitorSessions = Array.from(filteredSessions.values()).filter(s => s.visitor_id === visitor.id);

    // Aggregate page data
    const pageData = {};
    visitorEvents.forEach(event => {
      if (event.page?.url) {
        if (!pageData[event.page.url]) {
          pageData[event.page.url] = {
            url: event.page.url,
            title: event.page.title,
            visits: 0,
            total_time: 0,
            max_scroll: 0,
            clicks: []
          };
        }
        pageData[event.page.url].visits++;

        if (event.event_type === 'time_on_page') {
          pageData[event.page.url].total_time = event.seconds || 0;
        }
        if (event.event_type === 'scroll') {
          pageData[event.page.url].max_scroll = Math.max(pageData[event.page.url].max_scroll, event.depth || 0);
        }
        if (event.event_type === 'click' && event.click_data) {
          pageData[event.page.url].clicks.push({
            text: event.click_data.text,
            element: event.click_data.element,
            timestamp: event.timestamp
          });
        }
      }
    });

    return {
      ...visitor,
      total_events: visitorEvents.length,
      total_sessions: visitorSessions.length,
      pages: Object.values(pageData),
      recent_activity: visitorEvents.slice(-5).reverse()
    };
  });

  // Enhanced stats
  const stats = {
    total_events: filteredEvents.length,
    total_visitors: filteredVisitors.size,
    total_sessions: filteredSessions.size,
    visitors_with_email: Array.from(filteredVisitors.values()).filter(v => v.email).length,
    total_campaigns: filteredCampaigns.length,
    recent_events: filteredEvents.slice(-20).reverse().map(event => {
      // Enrich events with more context
      return {
        ...event,
        scroll_context: event.event_type === 'scroll' ? `Scrolled to ${event.depth}%` : null,
        click_context: event.event_type === 'click' && event.click_data ?
          `Clicked "${event.click_data.text?.substring(0, 50)}"` : null,
        time_context: event.event_type === 'time_on_page' ?
          `${event.seconds}s on page` : null
      };
    }),
    detailed_visitors: detailedVisitors,
    active_pages: getActivePages(filteredEvents),
    campaigns: filteredCampaigns.slice(-10).reverse() // Last 10 campaigns
  };

  return NextResponse.json(stats);
}

// Helper to get currently active pages
function getActivePages(events) {
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);

  const recentPageviews = events.filter(e =>
    e.event_type === 'pageview' &&
    new Date(e.timestamp).getTime() > fiveMinutesAgo
  );

  const activePagesMap = {};
  recentPageviews.forEach(event => {
    const url = event.page?.url;
    if (url) {
      if (!activePagesMap[url]) {
        activePagesMap[url] = {
          url,
          title: event.page.title,
          active_visitors: new Set(),
          last_activity: event.timestamp
        };
      }
      activePagesMap[url].active_visitors.add(event.visitor_id);
      if (new Date(event.timestamp) > new Date(activePagesMap[url].last_activity)) {
        activePagesMap[url].last_activity = event.timestamp;
      }
    }
  });

  return Object.values(activePagesMap).map(page => ({
    ...page,
    active_visitors: page.active_visitors.size
  }));
}

// Check if any triggers should fire and generate AI emails
async function checkTriggers(visitor, session, event, events, visitors, sessions, campaigns, firedTriggers) {
  if (!visitor.email) return; // Need email to send remarketing

  const triggerKey = (type) => `${visitor.id}_${type}`;

  // Trigger 1: Abandoned page (spent >10s, scrolled >25%, then left)
  if (event.event_type === 'page_exit' &&
      session.time_on_site > 10 &&
      session.max_scroll > 25 &&
      !firedTriggers.has(triggerKey('abandoned_page'))) {

    console.log(`🎯 TRIGGER: Abandoned page for ${visitor.email}`);
    firedTriggers.add(triggerKey('abandoned_page'));

    // Log to context file
    if (visitor.client_id) {
      logVisitorActivity(visitor.client_id, visitor, event, 'abandoned_page');
    }

    await generateAndStoreCampaign(visitor, 'abandoned_page', events, campaigns);
  }

  // Trigger 2: High engagement (>15s on site, >1 page, >50% scroll)
  if (session.time_on_site > 15 &&
      session.pages_viewed.size >= 1 &&
      session.max_scroll > 50 &&
      !firedTriggers.has(triggerKey('high_engagement'))) {

    console.log(`🎯 TRIGGER: High engagement from ${visitor.email}`);
    firedTriggers.add(triggerKey('high_engagement'));

    // Log to context file
    if (visitor.client_id) {
      logVisitorActivity(visitor.client_id, visitor, event, 'high_engagement');
    }

    await generateAndStoreCampaign(visitor, 'high_engagement', events, campaigns);
  }

  // Trigger 3: Manual test trigger (for easy testing)
  if (event.event_type === 'identify' &&
      !firedTriggers.has(triggerKey('high_engagement'))) {

    console.log(`🎯 TRIGGER: Identify event - generating welcome campaign for ${visitor.email}`);
    firedTriggers.add(triggerKey('high_engagement'));

    // Log to context file
    if (visitor.client_id) {
      logVisitorActivity(visitor.client_id, visitor, event, 'high_engagement');
    }

    await generateAndStoreCampaign(visitor, 'high_engagement', events, campaigns);
  }

  // Trigger 3: Returning visitor (2+ sessions)
  if (visitor.sessions.size >= 2 &&
      !firedTriggers.has(triggerKey('returning_visitor'))) {

    console.log(`🎯 TRIGGER: Returning visitor ${visitor.email}`);
    firedTriggers.add(triggerKey('returning_visitor'));

    // Log to context file
    if (visitor.client_id) {
      logVisitorActivity(visitor.client_id, visitor, event, 'returning_visitor');
    }

    await generateAndStoreCampaign(visitor, 'returning_visitor', events, campaigns);
  }

  // Trigger 4: Form abandoned
  if (event.event_type === 'page_exit' &&
      event.abandoned_form_data &&
      !firedTriggers.has(triggerKey('form_abandoned'))) {

    console.log(`🎯 TRIGGER: Form abandoned for ${visitor.email}`);
    firedTriggers.add(triggerKey('form_abandoned'));
    await generateAndStoreCampaign(visitor, 'form_abandoned', events, campaigns);
  }
}

// Generate AI email using Claude and store campaign
async function generateAndStoreCampaign(visitor, triggerType, events, campaigns) {
  try {
    // Build detailed visitor profile for AI
    const visitorProfile = buildVisitorProfile(visitor, events);

    // Use Claude AI to generate value-based, human email
    const email = await generateClaudeEmail(visitorProfile, triggerType);

    // Store campaign
    const campaign = {
      id: `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      visitor_id: visitor.id,
      visitor_email: visitor.email,
      visitor_name: visitor.name,
      client_id: visitor.client_id, // Add client_id for filtering
      trigger_type: triggerType,
      email,
      created_at: new Date().toISOString(),
      status: 'generated',
      sent_at: null,
      opened_at: null,
      clicked_at: null
    };

    campaigns.push(campaign);
    console.log(`✅ Claude generated email for ${visitor.email}: "${email.subject}"`);

    return campaign;
  } catch (error) {
    console.error('❌ Campaign generation error:', error);

    // Fallback to basic email if Claude fails
    const visitorProfile = buildVisitorProfile(visitor, events);
    const email = generatePersonalizedEmail(visitorProfile, triggerType);
    const campaign = {
      id: `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      visitor_id: visitor.id,
      visitor_email: visitor.email,
      visitor_name: visitor.name,
      client_id: visitor.client_id,
      trigger_type: triggerType,
      email,
      created_at: new Date().toISOString(),
      status: 'generated'
    };
    campaigns.push(campaign);

    return campaign;
  }
}

// Build detailed visitor profile for AI email generation
function buildVisitorProfile(visitor, events) {
  const allEvents = events.filter(e => e.visitor_id === visitor.id);

  // Aggregate page data
  const pageData = {};
  allEvents.forEach(event => {
    if (event.page?.url) {
      if (!pageData[event.page.url]) {
        pageData[event.page.url] = {
          url: event.page.url,
          title: event.page.title,
          visits: 0,
          total_time: 0,
          max_scroll: 0,
          clicks: []
        };
      }
      pageData[event.page.url].visits++;

      if (event.event_type === 'time_on_page') {
        pageData[event.page.url].total_time = event.seconds || 0;
      }
      if (event.event_type === 'scroll') {
        pageData[event.page.url].max_scroll = Math.max(pageData[event.page.url].max_scroll, event.depth || 0);
      }
      if (event.event_type === 'click' && event.click_data) {
        pageData[event.page.url].clicks.push({
          text: event.click_data.text,
          element: event.click_data.element,
          timestamp: event.timestamp
        });
      }
    }
  });

  return {
    ...visitor,
    pages: Object.values(pageData),
    total_events: allEvents.length
  };
}

// Read client context file
function readClientContext(clientId) {
  if (!clientId) return null;

  try {
    const contextFile = path.join(process.cwd(), 'data', 'clients', clientId, 'context.md');
    if (fs.existsSync(contextFile)) {
      return fs.readFileSync(contextFile, 'utf-8');
    }
  } catch (error) {
    console.error('Error reading context file:', error);
  }
  return null;
}

// Append campaign to context file
function appendCampaignToContext(clientId, email, visitorEmail) {
  if (!clientId) return;

  try {
    const contextFile = path.join(process.cwd(), 'data', 'clients', clientId, 'context.md');
    if (!fs.existsSync(contextFile)) return;

    const campaignEntry = `
### Campaign - ${new Date().toISOString()}
**To:** ${visitorEmail}
**Subject:** ${email.subject}
**Type:** ${email.personalization_data?.campaign_type || 'unknown'}

\`\`\`
${email.body}
\`\`\`

---
`;

    fs.appendFileSync(contextFile, campaignEntry);
    console.log(`✅ Appended campaign to context for ${clientId}`);
  } catch (error) {
    console.error('Error appending campaign to context:', error);
  }
}

// Log visitor activity to context file
function logVisitorActivity(clientId, visitor, event, eventType) {
  if (!clientId) return;

  try {
    const contextFile = path.join(process.cwd(), 'data', 'clients', clientId, 'context.md');
    if (!fs.existsSync(contextFile)) return;

    let activityLog = '';
    const timestamp = new Date().toISOString();
    const visitorName = visitor.email || visitor.id;

    switch (eventType) {
      case 'new_visitor':
        activityLog = `
### 🆕 New Visitor - ${timestamp}
**Visitor:** ${visitorName}
**Status:** New lead - just arrived
**Sales Cycle Stage:** Awareness

---
`;
        break;

      case 'email_captured':
        activityLog = `
### ✉️ Email Captured - ${timestamp}
**Visitor:** ${visitorName}
**Email:** ${visitor.email}
**Status:** Lead qualified - contact info obtained
**Sales Cycle Stage:** Interest → Consideration

---
`;
        break;

      case 'high_engagement':
        const pages = visitor.pages?.length || 0;
        const topPages = visitor.pages?.slice(0, 3).map(p => p.title || p.url).join(', ') || 'unknown';
        activityLog = `
### 🔥 High Engagement Detected - ${timestamp}
**Visitor:** ${visitorName}
**Pages Viewed:** ${pages}
**Focus Areas:** ${topPages}
**Time on Site:** ${event.seconds || 'unknown'}s
**Status:** Hot lead - actively researching
**Sales Cycle Stage:** Consideration

---
`;
        break;

      case 'returning_visitor':
        const sessionCount = visitor.sessions?.size || 0;
        activityLog = `
### 🔄 Returning Visitor - ${timestamp}
**Visitor:** ${visitorName}
**Total Sessions:** ${sessionCount}
**Status:** Engaged lead - showing sustained interest
**Sales Cycle Stage:** Evaluation → Decision
**Action:** Consider personal outreach or demo offer

---
`;
        break;

      case 'form_submit':
        const formData = event.captured_data || {};
        activityLog = `
### 📝 Form Submitted - ${timestamp}
**Visitor:** ${visitorName}
**Form Data:** ${JSON.stringify(formData, null, 2)}
**Status:** Active lead - took action
**Sales Cycle Stage:** Intent
**Action:** Follow up within 24 hours

---
`;
        break;

      case 'abandoned_page':
        const pageTitle = event.page?.title || 'Unknown page';
        activityLog = `
### ⚠️ Page Abandoned - ${timestamp}
**Visitor:** ${visitorName}
**Page:** ${pageTitle}
**Time Spent:** ${event.seconds || 'unknown'}s
**Scroll Depth:** ${event.depth || 'unknown'}%
**Status:** Warm lead - showed interest but left
**Sales Cycle Stage:** Consideration (stalled)
**Action:** Send re-engagement email

---
`;
        break;

      default:
        return; // Don't log unimportant events
    }

    if (activityLog) {
      fs.appendFileSync(contextFile, activityLog);
      console.log(`📝 Logged ${eventType} activity for ${clientId}`);
    }
  } catch (error) {
    console.error('Error logging visitor activity:', error);
  }
}

// Claude AI email generation - creates human, value-based emails
async function generateClaudeEmail(visitor, triggerType) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  No Claude API key - falling back to template emails');
    return generatePersonalizedEmail(visitor, triggerType);
  }

  // Read client context for business-specific information
  const clientContext = readClientContext(visitor.client_id);

  // Analyze visitor behavior to understand their journey
  const pagesVisited = visitor.pages?.map(p => ({
    title: p.title || 'Untitled',
    url: p.url,
    engaged: p.max_scroll > 50 || p.total_time > 30
  })) || [];

  const highValuePages = pagesVisited.filter(p =>
    p.url.includes('pricing') ||
    p.url.includes('contact') ||
    p.url.includes('demo') ||
    p.url.includes('features')
  );

  const returningVisitor = visitor.sessions?.size > 1;

  // Determine campaign context
  let campaignContext = '';
  switch (triggerType) {
    case 'high_engagement':
      campaignContext = 'This visitor showed strong engagement. They\'re researching solutions and evaluating options.';
      break;
    case 'abandoned_page':
      campaignContext = 'Visitor showed interest but left before taking action. They may have questions or concerns.';
      break;
    case 'returning_visitor':
      campaignContext = 'Visitor came back multiple times. They\'re seriously considering this but may need a push.';
      break;
    case 'form_abandoned':
      campaignContext = 'Visitor started a form but didn\'t complete it. Remove friction and make it easy to engage.';
      break;
    default:
      campaignContext = 'Visitor showed interest in the product/service.';
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1200,
      temperature: 0.9, // Higher creativity for more human emails
      messages: [{
        role: 'user',
        content: `You are Jordan, a real human sales/marketing person at a company. Your job is to write SHORT, punchy, value-driven emails that get people to take action.

${clientContext ? `BUSINESS CONTEXT (READ THIS FIRST - This is YOUR business info and past campaigns):
${clientContext}

Use this context to understand the business, its tone, target audience, and past campaign history. Make sure your email fits the business style and doesn't repeat past campaigns.

---

` : ''}VISITOR DATA:
- Name: ${visitor.name || visitor.email?.split('@')[0] || 'there'}
- Email: ${visitor.email}
- Pages visited: ${pagesVisited.map(p => p.title).join(', ')}
- High-value pages: ${highValuePages.length > 0 ? highValuePages.map(p => p.title).join(', ') : 'None'}
- Returning visitor: ${returningVisitor ? 'Yes' : 'No'}

CAMPAIGN CONTEXT: ${campaignContext}

YOUR TASK:
Write a SHORT (3-4 sentences max) email that:
1. Sounds like it's from a REAL PERSON (use contractions, be casual, friendly)
2. Focuses on THEIR PROBLEMS and VALUE (not what they did on the site)
3. Creates urgency and drives ACTION (book a call, reply, etc.)
4. NEVER mentions metrics (no "I saw you spent X seconds" or "you visited Y pages")
5. Feels like a friendly human reaching out to help, not a sales robot

CRITICAL RULES:
- DO NOT say things like "I noticed you visited" or "I saw you were on our site"
- DO NOT mention time spent, pages viewed, scroll depth, or any metrics
- DO say things like "Hey, wanted to reach out..." or "Quick question..." or "Thought you might be interested..."
- Keep it SHORT - 3-4 sentences MAX
- Sign it "Jordan" (not "Jordan @ Company" or "The Team")
- Make it feel like a text message from a friend, not a formal business email

Good example:
"Hey Sarah,

Quick question - are you currently dealing with [problem]? I help companies like yours solve this with [solution].

Worth a quick 10-minute call?

Jordan"

OUTPUT FORMAT (JSON only, no explanation):
{
  "subject": "short, punchy subject line",
  "body": "the email body (3-4 sentences)",
  "campaign_type": "demo_request|pricing|nurture|case_study"
}`
      }]
    });

    // Parse Claude's response
    const responseText = message.content[0].text;
    let emailData;

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        emailData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON in response');
      }
    } catch (parseError) {
      console.error('⚠️  Failed to parse Claude response, using fallback');
      return generatePersonalizedEmail(visitor, triggerType);
    }

    console.log(`🤖 Claude generated ${emailData.campaign_type} email`);

    const generatedEmail = {
      subject: emailData.subject,
      body: emailData.body,
      tone: 'human',
      to: visitor.email,
      from: 'Jordan @ Attrios',
      generated_by: 'claude-ai',
      generated_at: new Date().toISOString(),
      personalization_data: {
        pages_visited: pagesVisited.length,
        high_value_pages: highValuePages.length,
        returning_visitor: returningVisitor,
        campaign_type: emailData.campaign_type,
        trigger_type: triggerType
      }
    };

    // Append campaign to context file for memory
    appendCampaignToContext(visitor.client_id, generatedEmail, visitor.email);

    return generatedEmail;

  } catch (error) {
    console.error('⚠️  Claude API error:', error.message);
    return generatePersonalizedEmail(visitor, triggerType);
  }
}

// Fallback email generation (used if Claude API fails)
function generatePersonalizedEmail(visitor, triggerType) {
  const name = visitor.name || visitor.email?.split('@')[0] || 'there';

  // Analyze visitor behavior
  const totalTime = visitor.pages?.reduce((sum, p) => sum + (p.total_time || 0), 0) || 0;
  const avgScroll = visitor.pages?.reduce((sum, p) => sum + (p.max_scroll || 0), 0) / (visitor.pages?.length || 1) || 0;
  const mostViewedPage = visitor.pages?.sort((a, b) => b.visits - a.visits)[0];
  const clickedItems = visitor.pages?.flatMap(p => p.clicks || []).map(c => c.text).filter(Boolean) || [];

  let subject = '';
  let body = '';
  let tone = 'professional';

  // Different email templates based on trigger type
  switch (triggerType) {
    case 'abandoned_page':
      subject = `${name}, still interested in ${mostViewedPage?.title || 'our offering'}?`;
      body = `Hey ${name},

I noticed you were checking out ${mostViewedPage?.title || 'our page'} earlier. You spent ${totalTime} seconds looking through it and ${avgScroll > 50 ? 'seemed pretty engaged' : 'started exploring'}.

${clickedItems.length > 0 ? `I saw you were particularly interested in "${clickedItems[0]}" - that's one of our most popular features.` : ''}

Was there something specific you wanted to know more about? I'm happy to answer any questions or set up a quick call.

Best,
Your Remarketing AI`;
      tone = 'friendly';
      break;

    case 'high_engagement':
      subject = `${name}, looks like you're interested - let's talk!`;
      body = `Hi ${name},

I noticed you spent ${totalTime} seconds exploring our site and checked out ${visitor.pages?.length || 0} different pages. That tells me you're seriously considering this.

You seemed most interested in:
${visitor.pages?.slice(0, 3).map(p => `• ${p.title}`).join('\n') || '• Our offerings'}

${avgScroll > 75 ? `You scrolled through everything - clearly doing your research.` : `You were digging into the details.`}

Want to hop on a quick 15-minute call? I can answer any questions and see if this is the right fit for you.

Let me know!
Your Remarketing AI`;
      tone = 'consultative';
      break;

    case 'returning_visitor':
      subject = `Welcome back, ${name}! Noticed you returned...`;
      body = `Hey ${name},

Saw you came back to check us out again. That's a good sign!

Last time you were looking at ${mostViewedPage?.title || 'our offerings'}. This time you've been checking out ${visitor.pages?.[visitor.pages.length - 1]?.title || 'more details'}.

${clickedItems.length > 2 ? `I can tell you're really researching this - you've clicked on ${clickedItems.length} different things.` : ''}

Ready to move forward, or still have questions? Either way, I'm here to help.

Let's chat,
Your Remarketing AI`;
      tone = 'warm';
      break;

    case 'form_abandoned':
      subject = `${name}, did something go wrong with the form?`;
      body = `Hi ${name},

I noticed you started filling out our form but didn't finish. No worries - happens to everyone!

${visitor.email ? `I have your email (${visitor.email}), so I wanted to reach out directly.` : ''}

Was something confusing? Did you need more information first? Or maybe you just got busy?

If you're still interested, I'd love to help you out. Just reply to this email or give me a call.

Thanks,
Your Remarketing AI`;
      tone = 'helpful';
      break;

    default:
      subject = `${name}, following up on your visit`;
      body = `Hey ${name},

Wanted to reach out after seeing you on our site. You checked out ${visitor.pages?.length || 1} pages and spent ${totalTime} seconds exploring.

Is this something you're seriously considering? Happy to answer any questions or provide more details.

Best,
Your Remarketing AI`;
      tone = 'professional';
  }

  return {
    subject,
    body,
    tone,
    to: visitor.email || 'unknown@example.com',
    generated_at: new Date().toISOString(),
    personalization_data: {
      total_time: totalTime,
      avg_scroll: Math.round(avgScroll),
      pages_viewed: visitor.pages?.length || 0,
      most_viewed_page: mostViewedPage?.title || 'Unknown',
      clicked_items: clickedItems.slice(0, 3),
      engagement_level: avgScroll > 75 ? 'high' : avgScroll > 50 ? 'medium' : 'low'
    }
  };
}

// Export data access functions for other API routes
export function getEvents() {
  return events;
}

export function getVisitors() {
  return Array.from(visitors.values());
}

export function getSessions() {
  return Array.from(sessions.values());
}

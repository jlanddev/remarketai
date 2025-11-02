import { NextResponse } from 'next/server';

// In-memory storage for demo (in production, use database)
const events = [];
const visitors = new Map();
const sessions = new Map();
const campaigns = []; // Store AI-generated emails
const firedTriggers = new Set(); // Track which triggers already fired

export async function POST(request) {
  try {
    const data = await request.json();

    // Store event
    const event = {
      ...data,
      server_timestamp: new Date().toISOString(),
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    events.push(event);

    // Update visitor profile
    const visitorId = data.visitor_id;
    if (!visitors.has(visitorId)) {
      visitors.set(visitorId, {
        id: visitorId,
        first_seen: event.timestamp,
        events: [],
        sessions: new Set(),
        email: null,
        name: null,
        phone: null
      });
    }

    const visitor = visitors.get(visitorId);
    visitor.events.push(event.id);
    visitor.sessions.add(data.session_id);
    visitor.last_seen = event.timestamp;

    // Capture user data if provided
    if (data.event_type === 'identify' && data.user_data) {
      visitor.email = data.user_data.email || visitor.email;
      visitor.name = data.user_data.name || visitor.name;
      visitor.phone = data.user_data.phone || visitor.phone;
    }

    // Capture form data
    if (data.event_type === 'form_submit' && data.captured_data) {
      visitor.email = data.captured_data.email || visitor.email;
      visitor.name = data.captured_data.name || visitor.name;
      visitor.phone = data.captured_data.phone || visitor.phone;
    }

    // Update session
    const sessionId = data.session_id;
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        id: sessionId,
        visitor_id: visitorId,
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
    await checkTriggers(visitor, session, event);

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
  // Build detailed visitor profiles
  const detailedVisitors = Array.from(visitors.values()).map(visitor => {
    const visitorEvents = events.filter(e => e.visitor_id === visitor.id);
    const visitorSessions = Array.from(sessions.values()).filter(s => s.visitor_id === visitor.id);

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
    total_events: events.length,
    total_visitors: visitors.size,
    total_sessions: sessions.size,
    visitors_with_email: Array.from(visitors.values()).filter(v => v.email).length,
    total_campaigns: campaigns.length,
    recent_events: events.slice(-20).reverse().map(event => {
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
    active_pages: getActivePages(events),
    campaigns: campaigns.slice(-10).reverse() // Last 10 campaigns
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
async function checkTriggers(visitor, session, event) {
  if (!visitor.email) return; // Need email to send remarketing

  const triggerKey = (type) => `${visitor.id}_${type}`;

  // Trigger 1: Abandoned page (spent >10s, scrolled >25%, then left)
  if (event.event_type === 'page_exit' &&
      session.time_on_site > 10 &&
      session.max_scroll > 25 &&
      !firedTriggers.has(triggerKey('abandoned_page'))) {

    console.log(`🎯 TRIGGER: Abandoned page for ${visitor.email}`);
    firedTriggers.add(triggerKey('abandoned_page'));
    await generateAndStoreCampaign(visitor, 'abandoned_page');
  }

  // Trigger 2: High engagement (>15s on site, >1 page, >50% scroll)
  if (session.time_on_site > 15 &&
      session.pages_viewed.size >= 1 &&
      session.max_scroll > 50 &&
      !firedTriggers.has(triggerKey('high_engagement'))) {

    console.log(`🎯 TRIGGER: High engagement from ${visitor.email}`);
    firedTriggers.add(triggerKey('high_engagement'));
    await generateAndStoreCampaign(visitor, 'high_engagement');
  }

  // Trigger 3: Manual test trigger (for easy testing)
  if (event.event_type === 'identify' &&
      !firedTriggers.has(triggerKey('high_engagement'))) {

    console.log(`🎯 TRIGGER: Identify event - generating welcome campaign for ${visitor.email}`);
    firedTriggers.add(triggerKey('high_engagement'));
    await generateAndStoreCampaign(visitor, 'high_engagement');
  }

  // Trigger 3: Returning visitor (2+ sessions)
  if (visitor.sessions.size >= 2 &&
      !firedTriggers.has(triggerKey('returning_visitor'))) {

    console.log(`🎯 TRIGGER: Returning visitor ${visitor.email}`);
    firedTriggers.add(triggerKey('returning_visitor'));
    await generateAndStoreCampaign(visitor, 'returning_visitor');
  }

  // Trigger 4: Form abandoned
  if (event.event_type === 'page_exit' &&
      event.abandoned_form_data &&
      !firedTriggers.has(triggerKey('form_abandoned'))) {

    console.log(`🎯 TRIGGER: Form abandoned for ${visitor.email}`);
    firedTriggers.add(triggerKey('form_abandoned'));
    await generateAndStoreCampaign(visitor, 'form_abandoned');
  }
}

// Generate AI email and store campaign
async function generateAndStoreCampaign(visitor, triggerType) {
  try {
    // Build detailed visitor profile for AI
    const visitorProfile = buildVisitorProfile(visitor);

    // Generate personalized email (simulated AI for now)
    const email = generatePersonalizedEmail(visitorProfile, triggerType);

    // Store campaign
    const campaign = {
      id: `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      visitor_id: visitor.id,
      visitor_email: visitor.email,
      visitor_name: visitor.name,
      trigger_type: triggerType,
      email,
      created_at: new Date().toISOString(),
      status: 'generated', // In production: 'generated' -> 'sent' -> 'delivered'
      sent_at: null,
      opened_at: null,
      clicked_at: null
    };

    campaigns.push(campaign);
    console.log(`✉️  Generated email for ${visitor.email}: "${email.subject}"`);

    return campaign;
  } catch (error) {
    console.error('Campaign generation error:', error);
  }
}

// Build detailed visitor profile for AI email generation
function buildVisitorProfile(visitor) {
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

// Simulated AI email generation (in production, use Claude/OpenAI API)
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

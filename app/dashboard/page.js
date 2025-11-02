'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [showTrackingScript, setShowTrackingScript] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchStats();
      const interval = setInterval(fetchStats, 3000);
      return () => clearInterval(interval);
    }
  }, [user]);

  async function fetchUser() {
    try {
      const response = await fetch('/api/user');
      const data = await response.json();

      if (!data.success) {
        // Not authenticated, redirect to login
        router.push('/login');
        return;
      }

      setUser(data.user);
    } catch (error) {
      console.error('Error fetching user:', error);
      router.push('/login');
    }
  }

  async function fetchStats() {
    if (!user) return;

    try {
      const response = await fetch(`/api/track?client_id=${user.clientId}`);
      const data = await response.json();
      setStats(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('✅ Copied to clipboard!');
  }

  async function sendEmail(campaign) {
    setSendingEmail(campaign.id);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign })
      });

      const result = await response.json();

      if (result.success) {
        alert(result.demo_mode
          ? '📧 Email logged to console (add RESEND_API_KEY to actually send)'
          : '✅ Email sent successfully!');
      } else {
        alert('❌ Failed to send email: ' + result.error);
      }
    } catch (error) {
      alert('❌ Error sending email: ' + error.message);
    } finally {
      setSendingEmail(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const identificationRate = stats.total_visitors > 0
    ? Math.round((stats.visitors_with_email / stats.total_visitors) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black text-white mb-1">
                Remarket<span className="text-blue-500">AI</span> Intelligence
              </h1>
              <p className="text-gray-400">
                {user?.company || user?.name || user?.email}'s Dashboard
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                <span className="text-green-400 text-sm font-medium">LIVE</span>
              </div>
              <button
                onClick={() => setShowTrackingScript(!showTrackingScript)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                📋 Get Tracking Code
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition border border-gray-600"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Tracking Script Panel */}
          {showTrackingScript && user && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mt-4">
              <h3 className="text-white font-bold mb-4">📋 Your Tracking Script</h3>
              <p className="text-gray-400 text-sm mb-4">
                Add this script to your website's HTML (before closing {"</body>"} tag):
              </p>
              <div className="bg-black rounded-lg p-4 mb-4 font-mono text-sm relative">
                <code className="text-green-400">
                  {`<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://your-site.com'}/track.js?id=${user.clientId}"></script>`}
                </code>
                <button
                  onClick={() => copyToClipboard(`<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://your-site.com'}/track.js?id=${user.clientId}"></script>`)}
                  className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Client ID:</p>
                  <code className="text-blue-400 font-mono">{user.clientId}</code>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">API Key:</p>
                  <code className="text-purple-400 font-mono text-xs">{user.apiKey}</code>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-5 gap-6 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition">
            <div className="flex items-center justify-between mb-4">
              <div className="text-gray-400 text-sm font-medium uppercase tracking-wide">Total Events</div>
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="text-4xl font-black text-white mb-2">
              {stats.total_events.toLocaleString()}
            </div>
            <div className="text-green-400 text-sm font-medium">
              +{stats.recent_events.length} recent
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-purple-500 transition">
            <div className="flex items-center justify-between mb-4">
              <div className="text-gray-400 text-sm font-medium uppercase tracking-wide">Unique Visitors</div>
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="text-4xl font-black text-white mb-2">
              {stats.total_visitors.toLocaleString()}
            </div>
            <div className="text-gray-400 text-sm font-medium">
              Tracked globally
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-green-500 transition">
            <div className="flex items-center justify-between mb-4">
              <div className="text-gray-400 text-sm font-medium uppercase tracking-wide">Active Sessions</div>
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="text-4xl font-black text-white mb-2">
              {stats.total_sessions.toLocaleString()}
            </div>
            <div className="text-gray-400 text-sm font-medium">
              Current sessions
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-blue-300 text-sm font-medium uppercase tracking-wide">Identified</div>
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-4xl font-black text-white mb-2">
              {stats.visitors_with_email.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500"
                  style={{ width: `${identificationRate}%` }}
                ></div>
              </div>
              <span className="text-blue-400 text-sm font-bold">{identificationRate}%</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-900/50 to-red-900/50 border border-orange-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-orange-300 text-sm font-medium uppercase tracking-wide">AI Campaigns</div>
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-4xl font-black text-white mb-2">
              {stats.total_campaigns?.toLocaleString() || 0}
            </div>
            <div className="text-orange-400 text-sm font-medium">
              {stats.campaigns?.length || 0} recent
            </div>
          </div>
        </div>

        {/* Active Pages */}
        {stats.active_pages && stats.active_pages.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Pages Being Viewed Right Now
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {stats.active_pages.map((page, idx) => (
                <div key={idx} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm truncate flex-1">{page.title || page.url}</span>
                    <span className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400 font-bold ml-2">
                      {page.active_visitors} viewing
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs truncate">{page.url}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    Last activity: {new Date(page.last_activity).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI-Generated Campaigns */}
        {stats.campaigns && stats.campaigns.length > 0 && (
          <div className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border border-orange-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                  <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI-Generated Remarketing Campaigns
                </h2>
                <p className="text-orange-300/70 text-sm">Personalized emails crafted based on visitor behavior</p>
              </div>
              <span className="px-4 py-2 bg-orange-500/20 border border-orange-500/40 rounded-lg text-orange-300 font-bold text-sm">
                {stats.total_campaigns} Total
              </span>
            </div>

            <div className="space-y-4">
              {stats.campaigns.map((campaign, idx) => (
                <div key={campaign.id} className="bg-gray-800/80 border border-gray-700 rounded-lg p-5 hover:border-orange-500/50 transition">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-semibold text-lg">{campaign.email?.subject || 'Email Campaign'}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            campaign.trigger_type === 'high_engagement' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                            campaign.trigger_type === 'abandoned_page' ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400' :
                            campaign.trigger_type === 'returning_visitor' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' :
                            'bg-red-500/10 border border-red-500/20 text-red-400'
                          }`}>
                            {campaign.trigger_type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm">
                          To: <span className="text-orange-300 font-medium">{campaign.visitor_email}</span>
                          {campaign.visitor_name && <span className="text-gray-500"> ({campaign.visitor_name})</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <div className="text-gray-400 text-xs">Generated</div>
                        <div className="text-gray-300 text-sm font-medium">
                          {new Date(campaign.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        onClick={() => sendEmail(campaign)}
                        disabled={sendingEmail === campaign.id}
                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                      >
                        {sendingEmail === campaign.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Sending...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            Send Email
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 mb-3">
                    <div className="text-orange-400 text-xs font-bold uppercase tracking-wide mb-2">AI-Generated Email Body:</div>
                    <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed font-mono">
                      {campaign.email?.body || 'Email content...'}
                    </div>
                  </div>

                  {campaign.email?.personalization_data && (
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-gray-400">Time: <span className="text-purple-400 font-medium">{campaign.email.personalization_data.total_time}s</span></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                        </svg>
                        <span className="text-gray-400">Scroll: <span className="text-yellow-400 font-medium">{campaign.email.personalization_data.avg_scroll}%</span></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-gray-400">Pages: <span className="text-blue-400 font-medium">{campaign.email.personalization_data.pages_viewed}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-1 rounded ${
                          campaign.email.personalization_data.engagement_level === 'high' ? 'bg-green-500/10 text-green-400' :
                          campaign.email.personalization_data.engagement_level === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                          'bg-red-500/10 text-red-400'
                        } font-bold`}>
                          {campaign.email.personalization_data.engagement_level.toUpperCase()} ENGAGEMENT
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Event Feed */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-gray-700 bg-gray-800/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Detailed Activity Stream</h2>
                <p className="text-gray-400 text-sm mt-1">Every click, scroll, and interaction in real-time</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span className="text-blue-400 text-xs font-medium">AUTO-REFRESH</span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-700 max-h-[700px] overflow-y-auto">
            {stats.recent_events && stats.recent_events.length > 0 ? (
              stats.recent_events.map((event, index) => (
                <div
                  key={event.id}
                  className="px-6 py-5 hover:bg-gray-700/30 transition-colors"
                  style={{ animation: `slideIn 0.3s ease-out ${index * 0.03}s` }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getEventColor(event.event_type)}`}>
                        <span className="text-2xl">{getEventIcon(event.event_type)}</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white font-bold text-lg">
                          {getEventTitle(event.event_type)}
                        </h3>
                        <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300 font-mono">
                          {event.event_type}
                        </span>
                        {event.captured_data?.email && (
                          <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400 font-medium">
                            ✓ EMAIL CAPTURED
                          </span>
                        )}
                      </div>

                      {/* Context based on event type */}
                      {event.scroll_context && (
                        <div className="mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-400 text-sm font-medium">{event.scroll_context}</span>
                            <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-[200px]">
                              <div
                                className="bg-gradient-to-r from-yellow-500 to-orange-500 h-full rounded-full"
                                style={{ width: `${event.depth}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {event.click_context && (
                        <div className="bg-purple-500/5 border border-purple-500/20 rounded px-3 py-2 mb-2">
                          <p className="text-purple-300 text-sm font-medium">
                            🖱️ {event.click_context}
                          </p>
                          {event.click_data?.element && (
                            <p className="text-purple-400/60 text-xs mt-1">
                              Element: &lt;{event.click_data.element.toLowerCase()}&gt;
                            </p>
                          )}
                        </div>
                      )}

                      {event.time_context && (
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-pink-400 text-sm font-medium">{event.time_context}</span>
                        </div>
                      )}

                      <p className="text-gray-400 text-sm mb-2">
                        📄 {event.page?.title || event.page?.url || 'Unknown page'}
                      </p>

                      {event.captured_data?.email && (
                        <div className="flex items-center gap-2 mt-2">
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="text-green-400 font-mono text-sm">{event.captured_data.email}</span>
                          {event.captured_data.name && (
                            <span className="text-gray-400 text-sm">• {event.captured_data.name}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <div className="text-gray-500 text-sm font-mono">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-gray-600 text-xs mt-1">
                        {event.visitor_id.slice(0, 12)}...
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-20 text-center">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">No Events Yet</h3>
                <p className="text-gray-400 mb-4">Waiting for tracking data...</p>
                <code className="inline-block px-4 py-2 bg-black border border-gray-700 rounded text-xs text-green-400 font-mono">
                  {`<script src="http://localhost:3003/track.js?id=demo"></script>`}
                </code>
              </div>
            )}
          </div>
        </div>

        {/* Visitor Profiles */}
        {stats.detailed_visitors && stats.detailed_visitors.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-700 bg-gray-800/50">
              <h2 className="text-2xl font-bold text-white">Visitor Profiles</h2>
              <p className="text-gray-400 text-sm mt-1">Detailed behavior analysis for each visitor</p>
            </div>
            <div className="p-6 space-y-4">
              {stats.detailed_visitors.slice(0, 5).map((visitor, idx) => (
                <div key={visitor.id} className="bg-gray-700/50 rounded-lg p-6 border border-gray-600">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white font-bold text-lg">
                          {visitor.email || visitor.name || `Visitor ${visitor.id.slice(0, 8)}`}
                        </h3>
                        {visitor.email && (
                          <span className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">
                            IDENTIFIED
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm font-mono">{visitor.id}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-400 text-sm">
                        {visitor.total_events} events • {visitor.total_sessions} sessions
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        First seen: {new Date(visitor.first_seen).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Pages visited */}
                  {visitor.pages && visitor.pages.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-white font-semibold mb-3">Pages Visited:</h4>
                      <div className="space-y-3">
                        {visitor.pages.map((page, pidx) => (
                          <div key={pidx} className="bg-gray-800 rounded p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white font-medium">{page.title || page.url}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-sm">{page.visits}x visited</span>
                                <span className="text-pink-400 text-sm">{page.total_time}s</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-yellow-400 text-sm">{page.max_scroll}%</span>
                                  <div className="w-16 bg-gray-700 rounded-full h-2">
                                    <div
                                      className="bg-gradient-to-r from-yellow-500 to-orange-500 h-full rounded-full"
                                      style={{ width: `${page.max_scroll}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {page.clicks && page.clicks.length > 0 && (
                              <div className="mt-2">
                                <p className="text-gray-500 text-xs mb-1">Clicked:</p>
                                <div className="flex flex-wrap gap-2">
                                  {page.clicks.slice(0, 3).map((click, cidx) => (
                                    <span key={cidx} className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-300">
                                      "{click.text?.substring(0, 30)}{click.text?.length > 30 ? '...' : ''}"
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-xl mb-2">Detailed Tracking Active</h3>
              <p className="text-gray-400 mb-4">
                Every visitor action is now tracked with full context - scroll depth, click targets, time on page, and more. This data powers AI-generated personalized remarketing.
              </p>
              <div className="flex gap-3">
                <code className="flex-1 p-4 bg-black rounded border border-gray-700 text-sm text-green-400 font-mono overflow-x-auto">
                  {`<script src="http://localhost:3003/track.js?id=demo"></script>`}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText('<script src="http://localhost:3003/track.js?id=demo"></script>')}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition border border-gray-600"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function getEventIcon(eventType) {
  const icons = {
    pageview: '👁️',
    click: '👆',
    form_submit: '📝',
    scroll: '📜',
    time_on_page: '⏱️',
    page_exit: '👋',
    identify: '🎯'
  };
  return icons[eventType] || '📌';
}

function getEventTitle(eventType) {
  const titles = {
    pageview: 'Page View',
    click: 'Click Event',
    form_submit: 'Form Submitted',
    scroll: 'Scroll Depth',
    time_on_page: 'Time on Page',
    page_exit: 'Page Exit',
    identify: 'User Identified'
  };
  return titles[eventType] || eventType;
}

function getEventColor(eventType) {
  const colors = {
    pageview: 'bg-blue-500/10 border border-blue-500/20',
    click: 'bg-purple-500/10 border border-purple-500/20',
    form_submit: 'bg-green-500/10 border border-green-500/20',
    scroll: 'bg-yellow-500/10 border border-yellow-500/20',
    time_on_page: 'bg-pink-500/10 border border-pink-500/20',
    page_exit: 'bg-red-500/10 border border-red-500/20',
    identify: 'bg-cyan-500/10 border border-cyan-500/20'
  };
  return colors[eventType] || 'bg-gray-500/10 border border-gray-500/20';
}

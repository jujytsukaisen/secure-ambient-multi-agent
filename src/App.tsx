/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { initAuth, googleSignIn, logout } from './lib/firebaseAuth';
import { fetchRecentEmails, EmailMessage, sendEmailReport } from './lib/gmailService';
import { createGoogleSheetReport, createCalendarEvent } from './lib/workspaceService';
import { User } from 'firebase/auth';

interface Task {
  id: number;
  text: string;
  status: string;
  color: string;
  opacity: string;
  calendarLink?: string;
  startTime?: string;
  endTime?: string;
}

export default function App() {
  const [inputText, setInputText] = useState("");
  const [events, setEvents] = useState([
    { time: "14:22:01", source: "PLANNER", text: "Incoming email event: ID_9283-X", type: "DEBUG" },
    { time: "14:22:03", source: "FILTER", text: "Classified: meeting_request | Priority: HIGH", type: "SAFE" }
  ]);
  const [isScanning, setIsScanning] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isGmailScanning, setIsGmailScanning] = useState(false);
  const [gmailEmails, setGmailEmails] = useState<EmailMessage[]>([]);
  const [emailAnalyses, setEmailAnalyses] = useState<Record<string, {
    classification: string;
    priority: string;
    isPromptInjection: boolean;
    action: string;
    details: string;
  }>>(() => {
    try {
      const stored = localStorage.getItem('emailAnalyses');
      return stored ? (JSON.parse(stored) || {}) : {};
    } catch {
      return {};
    }
  });

  const [lastScanTime, setLastScanTime] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('lastScanTime');
      const parsed = stored ? parseInt(stored) : 0;
      return isNaN(parsed) ? 0 : parsed;
    } catch {
      return 0;
    }
  });

  const [nextScanCountdown, setNextScanCountdown] = useState<string>("30:00");

  const [reportedEmails, setReportedEmails] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('reportedEmails');
      return stored ? (JSON.parse(stored) || {}) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const keys = Object.keys(reportedEmails);
      if (keys.length > 200) {
        const capped = {};
        keys.slice(keys.length - 200).forEach(k => {
          capped[k] = true;
        });
        localStorage.setItem('reportedEmails', JSON.stringify(capped));
      } else {
        localStorage.setItem('reportedEmails', JSON.stringify(reportedEmails));
      }
    } catch (e) {
      console.warn("Failed to write to localStorage", e);
    }
  }, [reportedEmails]);

  const [googleSheetUrl, setGoogleSheetUrl] = useState<string | null>(null);
  const [isExportingToSheet, setIsExportingToSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Automated Scan and Email Loop States (Every 30 mins)
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleHour, setScheduleHour] = useState(15); // 15 = 3:00 PM
  const [scheduleMinute, setScheduleMinute] = useState(0); // 00 minutes
  const [lastExecutedDate, setLastExecutedDate] = useState<string | null>(null);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState("نشط ومراقب للوقت (Active)");
  const [lastEmailSentStatus, setLastEmailSentStatus] = useState<string | null>(null);

  // Sync emailAnalyses to localStorage
  useEffect(() => {
    try {
      const keys = Object.keys(emailAnalyses);
      if (keys.length > 200) {
        const capped = {};
        // Keep the last 200 keys
        keys.slice(keys.length - 200).forEach(k => {
          capped[k] = emailAnalyses[k];
        });
        localStorage.setItem('emailAnalyses', JSON.stringify(capped));
      } else {
        localStorage.setItem('emailAnalyses', JSON.stringify(emailAnalyses));
      }
    } catch (e) {
      console.warn("Failed to write emailAnalyses to localStorage", e);
    }
  }, [emailAnalyses]);

  const [agents, setAgents] = useState({
    security: { status: 'WATCHING', detail: 'Monitoring for threats...', isScanning: false },
    planner: { status: 'IDLE', detail: 'Ready for events...' },
    filter: { status: 'SCANNING', detail: 'Simulating deep scan latency...', isScanning: false },
    calendar: { status: 'WAITING', detail: 'Auth required' },
    summary: { status: 'SCHEDULED', detail: 'Trigger: 18:00 EST' }
  });

  const [stats, setStats] = useState({
    errors: 0,
    attacks: 1,
    redacted: 14
  });

  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: "Update project schema", status: "COMPLETED", color: "bg-green-500", opacity: "" },
    { id: 2, text: "Email: Client Feedback", status: "REPLY_REQ", color: "bg-amber-500", opacity: "" },
    { id: 3, text: "Meeting: Design Sync", status: "PENDING_AUTH", color: "bg-cyan-500", opacity: "" },
    { id: 4, text: "Review spam folder", status: "LOW_PRIO", color: "bg-slate-500", opacity: "opacity-30" }
  ]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
        setAgents(prev => ({
          ...prev,
          calendar: { status: 'CONNECTED', detail: 'Gmail & Calendar connected' }
        }));
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
        setAgents(prev => ({
          ...prev,
          calendar: { status: 'WAITING', detail: 'Auth required' }
        }));
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
        setEvents(prev => [...prev, {
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          source: "AUTH",
          text: `Signed in as ${result.user.email}. Connected to Gmail successfully.`,
          type: "SAFE"
        }]);
      }
    } catch (err: any) {
      console.error(err);
      setEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: "AUTH",
        text: `Authentication failed: ${err.message}`,
        type: "FLAGGED"
      }]);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setCurrentUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setEvents(prev => [...prev, {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      source: "AUTH",
      text: "Signed out successfully",
      type: "DEBUG"
    }]);
  };

  const scanGmailInbox = async () => {
    if (!accessToken) return;
    setIsGmailScanning(true);
    setAgents(prev => ({
      ...prev,
      planner: { status: 'SCANNING', detail: 'Fetching emails from Gmail inbox...' },
      filter: { status: 'PENDING', detail: 'Waiting for emails...', isScanning: false }
    }));

    setEvents(prev => [...prev, {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      source: "GMAIL",
      text: "Initiating live Gmail inbox scan...",
      type: "DEBUG"
    }]);
    try {
      const fetched = await fetchRecentEmails(accessToken, 5);
      
      const unscannedEmails = fetched.filter(email => !emailAnalyses[email.id]);
      
      setGmailEmails(prev => {
        const combined = [...fetched, ...prev];
        const uniqueIds = new Set();
        return combined.filter(e => {
          if (!uniqueIds.has(e.id)) {
            uniqueIds.add(e.id);
            return true;
          }
          return false;
        }).slice(0, 50);
      });
      
      if (unscannedEmails.length === 0) {
        setEvents(prev => [...prev, {
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          source: "GMAIL",
          text: "Scan complete: No new unanalyzed emails found.",
          type: "SAFE"
        }]);
        setAgents(prev => ({
          ...prev,
          planner: { status: 'IDLE', detail: 'No new emails to process.' }
        }));
        setIsGmailScanning(false);
        return;
      }

      setEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: "GMAIL",
        text: `Found ${unscannedEmails.length} new emails. Starting threat & action batch analysis...`,
        type: "DEBUG"
      }]);

      setAgents(prev => ({
        ...prev,
        security: { status: 'SCANNING', detail: `Deep inspecting ${unscannedEmails.length} emails...`, isScanning: true },
        planner: { status: 'ROUTING', detail: `Analyzing all ${unscannedEmails.length} emails in a secure batch...` },
        filter: { status: 'SCANNING', detail: `Calling AI model once for the batch...`, isScanning: true }
      }));

      const batchItems = unscannedEmails.map(email => ({
        id: email.id,
        text: `From: ${email.from}\nSubject: ${email.subject}\nSnippet: ${email.snippet}`
      }));

      try {
        const batchResponse = await fetch('/api/analyze-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batchItems })
        });

        if (!batchResponse.ok) {
          throw new Error(`API error: ${batchResponse.statusText}`);
        }

        const batchData = await batchResponse.json();

        for (const email of unscannedEmails) {
          const data = batchData[email.id] || {
            classification: "low_priority",
            priority: "LOW",
            isPromptInjection: false,
            action: "تصنيف تلقائي",
            details: "تحليل محلي احتياطي"
          };
          setEmailAnalyses(prev => ({ ...prev, [email.id]: data }));

          if (data.isPromptInjection) {
            setStats(s => ({ ...s, attacks: s.attacks + 1 }));
            setAgents(prev => ({
              ...prev,
              security: { status: 'THREAT DETECTED', detail: 'Blocked prompt injection attempt.', isScanning: false },
              planner: { status: 'ALERT', detail: 'Security violation detected!' },
              filter: { status: 'BLOCKED', detail: 'Malicious email isolated.', isScanning: false }
            }));
            setEvents(prev => [...prev, {
              time: new Date().toLocaleTimeString('en-US', { hour12: false }),
              source: "SECURITY",
              text: `BLOCKED Prompt Injection in email "${email.subject}" from ${email.from}`,
              type: "FLAGGED"
            }]);
          } else {
            setAgents(prev => ({
              ...prev,
              security: { status: 'WATCHING', detail: 'Monitoring for threats...', isScanning: false },
              planner: { status: 'ROUTED', detail: `Email processed successfully` },
              filter: { status: 'IDLE', detail: `Classified as ${data.classification}`, isScanning: false }
            }));
            setEvents(prev => [...prev, {
              time: new Date().toLocaleTimeString('en-US', { hour12: false }),
              source: "FILTER",
              text: `Classified email "${email.subject}" as [${data.classification}] | Priority: ${data.priority}`,
              type: "SAFE"
            }]);

            setTasks(prev => [{
              id: Date.now() + Math.random(),
              text: `Email: ${email.subject}`,
              status: data.classification === "meeting_request" ? "PENDING_AUTH" : data.classification === "important" ? "REPLY_REQ" : "NEW",
              color: data.classification === "important" ? "bg-rose-500" : data.classification === "meeting_request" ? "bg-cyan-500" : "bg-green-500",
              opacity: "",
              startTime: (data as any).meetingStartTime,
              endTime: (data as any).meetingEndTime
            }, ...prev]);
          }
        }
      } catch (batchErr: any) {
        console.error("Error processing batch manual scan:", batchErr);
      }

      setAgents(prev => ({
        ...prev,
        security: { status: 'WATCHING', detail: 'Monitoring for threats...', isScanning: false },
        planner: { status: 'IDLE', detail: 'Ready for events...' },
        filter: { status: 'IDLE', detail: 'Scanning complete.', isScanning: false }
      }));
    } catch (error) {
      console.error(error);
      setEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: "GMAIL",
        text: "Failed to scan Gmail inbox.",
        type: "FLAGGED"
      }]);
    } finally {
      setIsGmailScanning(false);
    }
  };

  const runScheduledDailyScan = async (isManualTest = false) => {
    if (!accessToken) return;
    
    setIsAutoProcessing(true);
    setSchedulerStatus("جاري فحص البريد الآن...");
    setEvents(prev => [...prev, {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      source: "SCHEDULER",
      text: "Starting scheduled background scan loop (30 mins)...",
      type: "DEBUG"
    }]);

    try {
      const fetched = await fetchRecentEmails(accessToken, 20);
      
      const unreportedEmails = fetched.filter(email => !reportedEmails[email.id]);
      
      if (unreportedEmails.length === 0) {
        const emptyHtml = `
          <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; background-color: #111; color: #eee; padding: 20px; border-radius: 8px;">
            <div style="background-color: #000; padding: 15px; border-radius: 6px; border: 1px solid #333; margin-bottom: 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px;">🛡️ تقرير فحص البريد والتهديدات التلقائي</h1>
              <p style="color: #06b6d4; font-size: 12px; margin: 5px 0 0 0; font-family: monospace;">SECURE AMBIENT ASSISTANT REPORT // AUTO LOOP (30 MIN)</p>
            </div>
            <p style="font-size: 14px; line-height: 1.6;">مرحباً،</p>
            <p style="font-size: 14px; line-height: 1.6;">تم تشغيل الفحص التلقائي (كل 30 دقيقة) ولم يتم العثور على أي رسائل بريد إلكتروني جديدة لم تُفحص مسبقاً في صندوق الوارد.</p>
            <div style="margin-top: 30px; border-top: 1px solid #1f1f1f; padding-top: 15px; font-size: 11px; color: #6b7280; text-align: center;">
              هذا التقرير تم توليده تلقائياً بواسطة المساعد الشخصي الذكي المستضاف بأمان.
            </div>
          </div>
        `;
        const userEmail = currentUser?.email || "user@gmail.com";
        await sendEmailReport(accessToken, userEmail, "تقرير الفحص التلقائي - لا توجد رسائل جديدة", emptyHtml);
        
        setLastEmailSentStatus(`تم الإرسال بنجاح إلى ${userEmail} (لا توجد رسائل جديدة للفحص)`);
        setIsAutoProcessing(false);
        setSchedulerStatus("نشط ومراقب للوقت (Active)");
        return;
      }

      const results: { email: EmailMessage; result: any }[] = [];
      let injectionCount = 0;
      let safeCount = 0;
      
      const newlyReportedIds = { ...reportedEmails };

      const unanalyzedEmails = unreportedEmails.filter(email => !emailAnalyses[email.id]);
      
      const batchItems = unanalyzedEmails.map(email => ({
        id: email.id,
        text: `From: ${email.from}\nSubject: ${email.subject}\nSnippet: ${email.snippet}`
      }));

      try {
        let batchData: any = {};
        if (batchItems.length > 0) {
          const batchResponse = await fetch('/api/analyze-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: batchItems })
          });
  
          if (!batchResponse.ok) {
            throw new Error(`API error: ${batchResponse.statusText}`);
          }
          batchData = await batchResponse.json();
        }

        for (const email of unreportedEmails) {
          const data = emailAnalyses[email.id] || batchData[email.id] || {
            classification: "low_priority",
            priority: "LOW",
            isPromptInjection: false,
            action: "تصنيف تلقائي",
            details: "تحليل محلي احتياطي"
          };

          results.push({ email, result: data });
          setEmailAnalyses(prev => ({ ...prev, [email.id]: data }));
          newlyReportedIds[email.id] = true;

          if (data.isPromptInjection) {
            injectionCount++;
            setStats(s => ({ ...s, attacks: s.attacks + 1 }));
            setEvents(prev => [...prev, {
              time: new Date().toLocaleTimeString('en-US', { hour12: false }),
              source: "SECURITY",
              text: `[SCHEDULER BLOCK] Prompt Injection in email "${email.subject}" from ${email.from}`,
              type: "FLAGGED"
            }]);
          } else {
            safeCount++;
            setTasks(prev => {
              if (prev.some(t => t.text.includes(email.subject))) return prev;
              return [{
                id: Date.now() + Math.random(),
                text: `Email: ${email.subject}`,
                status: data.classification === "meeting_request" ? "PENDING_AUTH" : data.classification === "important" ? "REPLY_REQ" : "NEW",
                color: data.classification === "important" ? "bg-rose-500" : data.classification === "meeting_request" ? "bg-cyan-500" : "bg-green-500",
                opacity: "",
                startTime: (data as any).meetingStartTime,
                endTime: (data as any).meetingEndTime
              }, ...prev];
            });
          }
        }
      } catch (batchErr: any) {
        console.error("Error processing batch scheduled scan:", batchErr);
        for (const email of unreportedEmails) {
          const fallbackData = emailAnalyses[email.id] || { classification: "low_priority", priority: "LOW", isPromptInjection: false, action: "تصنيف تلقائي", details: "تحليل محلي احتياطي" };
          results.push({ email, result: fallbackData });
          setEmailAnalyses(prev => ({ ...prev, [email.id]: fallbackData }));
          newlyReportedIds[email.id] = true;
        }
      }

      setReportedEmails(newlyReportedIds);
      
      const sheetEventsForNewScan = results.map(item => ({
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: item.result.isPromptInjection ? 'SECURITY_ALERT' : 'GMAIL_SCAN',
        text: `Email: ${item.email.subject} | Action: ${item.result.action}`,
        type: item.result.isPromptInjection ? 'FLAGGED' as const : 'SAFE' as const
      }));

      let autoSpreadsheetUrl = '';
      try {
        autoSpreadsheetUrl = await createGoogleSheetReport(accessToken, sheetEventsForNewScan);
      } catch (err) {
        console.warn("Could not create google sheet for auto report:", err);
      }

      const emailRowsHtml = results.map(item => `
        <div style="background-color: ${item.result.isPromptInjection ? '#3b0707' : '#111827'}; border: 1px solid ${item.result.isPromptInjection ? '#ef4444' : '#374151'}; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
          <h4 style="margin: 0 0 10px 0; color: ${item.result.isPromptInjection ? '#ef4444' : '#60a5fa'}; font-size: 15px;">
            ${item.result.isPromptInjection ? '⚠️ محاولة اختراق محجوبة' : '✅ رسالة آمنة'}
          </h4>
          <p style="margin: 5px 0; font-size: 13px; color: #d1d5db;"><strong>الموضوع:</strong> ${item.email.subject}</p>
          <p style="margin: 5px 0; font-size: 13px; color: #d1d5db;"><strong>المرسل:</strong> ${item.email.from}</p>
          <p style="margin: 5px 0; font-size: 13px; color: #d1d5db;"><strong>التصنيف:</strong> ${item.result.classification} | <strong>الأولوية:</strong> ${item.result.priority}</p>
          <p style="margin: 5px 0; font-size: 13px; color: #d1d5db;"><strong>الإجراء المتخذ:</strong> ${item.result.action}</p>
          <p style="margin: 5px 0; font-size: 13px; color: #9ca3af;"><strong>التفاصيل:</strong> ${item.result.details}</p>
        </div>
      `).join('');

      const userEmail = currentUser?.email || "user@gmail.com";
      const reportHtml = `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; background-color: #0a0a0a; color: #eee; padding: 20px; border-radius: 8px;">
          <div style="background-color: #000; padding: 15px; border-radius: 6px; border: 1px solid #333; margin-bottom: 20px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px;">🛡️ تقرير فحص البريد والتهديدات التلقائي</h1>
            <p style="color: #06b6d4; font-size: 12px; margin: 5px 0 0 0; font-family: monospace;">SECURE AMBIENT ASSISTANT REPORT // AUTO LOOP (30 MIN)</p>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6;">مرحباً <strong>${userEmail}</strong>،</p>
          <p style="font-size: 14px; line-height: 1.6;">تم تشغيل الفحص التلقائي للبريد الإلكتروني بنجاح (كل 30 دقيقة). أدناه تفاصيل التحليل الأمني وتصنيفات الرسائل الجديدة المكتشفة:</p>
          
          <div style="background-color: #161616; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #222;">
            <h3 style="color: #06b6d4; margin-top: 0; font-size: 15px; border-bottom: 1px solid #333; padding-bottom: 8px;">📊 ملخص الفحص الجديد</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: right;">
              <tr>
                <td style="padding: 6px 0; color: #9ca3af;">الرسائل الجديدة المكتشفة والمفحوصة:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #ffffff;">${results.length}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #9ca3af;">هجمات حقن الأوامر المكتشفة والمحجوبة:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #ef4444;">${injectionCount}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #9ca3af;">الرسائل الآمنة المكتشفة:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #10b981;">${safeCount}</td>
              </tr>
            </table>
          </div>

          ${autoSpreadsheetUrl ? `
          <div style="text-align: center; margin: 25px 0;">
            <a href="${autoSpreadsheetUrl}" target="_blank" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 6px; font-size: 14px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2); text-align: center;">
              📊 افتح التقرير الكامل كملف Google Sheet
            </a>
          </div>
          ` : ''}
          
          <h3 style="color: #ffffff; font-size: 15px; margin-top: 25px; margin-bottom: 10px;">📨 تفاصيل الرسائل الجديدة المصنفة</h3>
          ${emailRowsHtml}
          
          <div style="margin-top: 30px; border-top: 1px solid #1f1f1f; padding-top: 15px; font-size: 11px; color: #6b7280; text-align: center;">
            هذا التقرير تم توليده وإرساله تلقائياً بواسطة المساعد الشخصي الذكي المستضاف بأمان.
          </div>
        </div>
      `;

      // 4. Send Gmail report with Google Sheets link included
      await sendEmailReport(accessToken, userEmail, "تقرير فحص البريد التلقائي (30 دقيقة)", reportHtml);

      setEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: "SCHEDULER",
        text: `Auto Report successfully emailed to ${userEmail} with Google Sheets Link!`,
        type: "SAFE"
      }]);

      setLastEmailSentStatus(`تم إرسال التقرير التلقائي مع شيت جوجل بنجاح إلى ${userEmail} في تمام الساعة ${new Date().toLocaleTimeString('en-US', { hour12: false })}`);
    } catch (error: any) {
      console.error("Scheduled task error:", error);
      setEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: "SCHEDULER",
        text: `Scheduled scan failed: ${error.message}`,
        type: "FLAGGED"
      }]);
    } finally {
      setIsAutoProcessing(false);
      setSchedulerStatus("نشط ومراقب للوقت (Active)");
      const nowMs = Date.now();
      setLastExecutedDate(new Date(nowMs).toLocaleString('en-US'));
      if (!isManualTest) {
        setLastScanTime(nowMs);
        try {
          localStorage.setItem('lastScanTime', nowMs.toString());
        } catch (e) {
          console.warn(e);
        }
      }
    }
  };

  useEffect(() => {
    const updateTimer = () => {
      if (!scheduleEnabled) {
        setNextScanCountdown("معطل");
        return;
      }
      const nowMs = Date.now();
      const elapsed = nowMs - lastScanTime;
      const intervalMs = 30 * 60 * 1000; // 30 minutes
      const remaining = intervalMs - elapsed;
      if (remaining <= 0) {
        setNextScanCountdown("00:00");
        if (!isAutoProcessing) {
          setLastScanTime(nowMs);
          try {
            localStorage.setItem('lastScanTime', nowMs.toString());
          } catch (e) {
            console.warn(e);
          }
          runScheduledDailyScan(false);
        }
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setNextScanCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [scheduleEnabled, lastScanTime, accessToken, isAutoProcessing, reportedEmails, emailAnalyses]);

  // 10-Minute Urgent Watchdog (Real-time monitor)
  useEffect(() => {
    if (!scheduleEnabled || !accessToken) return;

    const runUrgentScan = async () => {
      if (isAutoProcessing || isGmailScanning) return; // avoid overlapping scans
      
      try {
        const fetched = await fetchRecentEmails(accessToken, 5);
        // Exclude emails sent by the system alert itself to prevent infinite loops
        const unscannedEmails = fetched.filter(email => 
          !emailAnalyses[email.id] && 
          !email.subject.includes("إشعار فوري: رسالة هامة تم رصدها") &&
          !email.subject.includes("Daily Summary")
        );
        
        if (unscannedEmails.length === 0) return;

        const batchItems = unscannedEmails.map(email => ({
          id: email.id,
          text: `From: ${email.from}\nSubject: ${email.subject}\nSnippet: ${email.snippet}`
        }));

        let batchData: any = {};
        try {
          const batchResponse = await fetch('/api/analyze-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: batchItems })
          });
          
          if (batchResponse.ok) {
            batchData = await batchResponse.json();
          }
        } catch (e) {
          console.warn("Urgent watchdog batch analysis error:", e);
        }
        
        const newAnalysesEntries: Record<string, any> = {};
        for (const email of unscannedEmails) {
          const data = batchData[email.id] || {
            classification: "low_priority",
            priority: "LOW",
            isPromptInjection: false,
            action: "تصنيف تلقائي",
            details: "تحليل محلي احتياطي"
          };
          newAnalysesEntries[email.id] = data;
        }

        // Commit state immediately to avoid concurrent scan duplication
        setEmailAnalyses(prev => ({ ...prev, ...newAnalysesEntries }));

        let newEvents: typeof events = [];
        let newSpam = 0;
        let newTasks = 0;
        let newMeetings = 0;
        let newAttacks = 0;

        for (const email of unscannedEmails) {
          const data = newAnalysesEntries[email.id];
          if (reportedEmails[email.id]) continue;

          if (data.isPromptInjection) newAttacks++;
          if (data.classification === 'spam') newSpam++;
          if (data.classification === 'task') newTasks++;
          if (data.classification === 'meeting_request') newMeetings++;

          if (data.isPromptInjection || data.priority === "HIGH" || data.classification === "important" || data.classification === "meeting_request") {
            const alertHtml = `
              <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; background-color: #3b0707; color: #d1d5db; padding: 25px; border-radius: 8px; border: 1px solid #ef4444; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #ef4444; margin: 0; font-size: 20px;">🚨 إشعار فوري: رسالة هامة أو تهديد أمني</h1>
                <p>مرحباً، لقد رصد المساعد الشخصي رسالة تتطلب انتباهك الفوري.</p>
                <div style="background-color: #1a0505; padding: 15px; border: 1px solid #ef4444; border-radius: 6px; margin: 20px 0;">
                  <p><strong>الموضوع:</strong> ${email.subject}</p>
                  <p><strong>من:</strong> ${email.from}</p>
                  <p><strong>التصنيف:</strong> ${data.classification === 'important' ? 'رسالة هامة' : data.classification === 'meeting_request' ? 'طلب اجتماع' : 'تحذير أمني'}</p>
                  <p><strong>الإجراء:</strong> ${data.action} - ${data.details}</p>
                </div>
                <div style="margin-top: 30px; border-top: 1px solid #ef4444; padding-top: 15px; font-size: 11px; color: #f87171; text-align: center;">
                  هذا إشعار تلقائي وفوري من المساعد الشخصي الذكي.
                </div>
              </div>
            `;
            try {
              await sendEmailReport(accessToken, currentUser?.email || "", "🚨 إشعار فوري: رسالة هامة تم رصدها", alertHtml);
              newEvents.push({
                time: new Date().toLocaleTimeString('en-US', { hour12: false }),
                source: "SCHEDULER",
                text: `URGENT ALERT sent for email: ${email.subject}`,
                type: "FLAGGED"
              });
              setReportedEmails(prev => ({ ...prev, [email.id]: true }));
            } catch (err) {
              console.error("Failed to send urgent alert:", err);
            }
          }
        }
        
        
        setGmailEmails(prev => {
          const combined = [...unscannedEmails, ...prev];
          // Remove duplicates based on ID
          const uniqueIds = new Set();
          return combined.filter(email => {
            if (!uniqueIds.has(email.id)) {
              uniqueIds.add(email.id);
              return true;
            }
            return false;
          }).slice(0, 50); // Keep max 50 in UI
        });
        
        if (newSpam > 0 || newTasks > 0 || newMeetings > 0 || newAttacks > 0) {
          setStats((prev: any) => ({
            ...prev,
            spam: (prev.spam || 0) + newSpam,
            tasks: (prev.tasks || 0) + newTasks,
            meetings: (prev.meetings || 0) + newMeetings,
            attacks: (prev.attacks || 0) + newAttacks
          }));
        }

        if (newEvents.length > 0) {
          setEvents(prev => [...newEvents, ...prev]);
        }
      } catch (err) {
         console.warn("Urgent watchdog error:", err);
      }
    };

    const urgentInterval = setInterval(runUrgentScan, 10 * 60 * 1000); // 10 minutes
    
    // Also run once initially after 5 seconds to catch anything right away
    const initialTimeout = setTimeout(runUrgentScan, 5000);

    return () => {
      clearInterval(urgentInterval);
      clearTimeout(initialTimeout);
    };
  }, [scheduleEnabled, accessToken, emailAnalyses, isAutoProcessing, isGmailScanning, currentUser]);

  const generateReport = () => {
    setIsGeneratingReport(true);
    setEvents(prev => [...prev, {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      source: "SYSTEM",
      text: "Generating manual summary report...",
      type: "DEBUG"
    }]);
    
    setTimeout(() => {
      setEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: "SUMMARY",
        text: `Report generated: ${tasks.length} active tasks. ${stats.attacks} security events blocked.`,
        type: "SAFE"
      }]);
      setShowReportModal(true);
      setIsGeneratingReport(false);
    }, 1500);
  };

  const approveTask = async (id: number, text: string, startTime?: string, endTime?: string) => {
    let calendarLink = '';
    
    setEvents(prev => [...prev, {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      source: "CALENDAR",
      text: `Scheduling "${text}" on Google Calendar...`,
      type: "DEBUG"
    }]);

    if (accessToken) {
      try {
        const result = await createCalendarEvent(accessToken, text, "Scheduled securely via Secure Ambient Assistant.", startTime, endTime);
        calendarLink = result.htmlLink;
        setEvents(prev => [...prev, {
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          source: "CALENDAR",
          text: `Event successfully booked on Google Calendar! Link: ${calendarLink}`,
          type: "SAFE"
        }]);
      } catch (err: any) {
        console.error(err);
        setEvents(prev => [...prev, {
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          source: "CALENDAR",
          text: `Google Calendar Scheduling failed: ${err.message}`,
          type: "FLAGGED"
        }]);
      }
    }

    setTasks(prev => prev.map(t => t.id === id ? { 
      ...t, 
      status: 'BOOKED', 
      color: 'bg-green-500',
      calendarLink: calendarLink || undefined
    } : t));
    
    setAgents(prev => ({
      ...prev,
      calendar: { status: 'BOOKED', detail: 'Meeting scheduled successfully' }
    }));

    setEvents(prev => [...prev, {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      source: "USER",
      text: `Approved task: "${text}"`,
      type: "SAFE"
    }]);
  };

  const exportReport = () => {
    const reportContent = events.map(ev => `[${ev.time}] [${ev.source}] ${ev.text}`).join('\n');
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily_report_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToGoogleSheets = async () => {
    if (!accessToken) {
      setSheetError("يرجى تسجيل الدخول أولاً لربط حساب Google.");
      return;
    }

    setIsExportingToSheet(true);
    setSheetError(null);
    setGoogleSheetUrl(null);

    setEvents(prev => [...prev, {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      source: "SYSTEM",
      text: "Creating daily report on Google Sheets...",
      type: "DEBUG"
    }]);

    try {
      const url = await createGoogleSheetReport(accessToken, events);
      setGoogleSheetUrl(url);
      setEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: "SYSTEM",
        text: `Successfully exported report to Google Sheets! Link: ${url}`,
        type: "SAFE"
      }]);
    } catch (err: any) {
      console.error(err);
      setSheetError(`فشل التصدير: ${err.message || 'خطأ غير معروف'}`);
      setEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: "SYSTEM",
        text: `Failed to export to Google Sheets: ${err.message}`,
        type: "FLAGGED"
      }]);
    } finally {
      setIsExportingToSheet(false);
    }
  };

  const analyzeInput = async () => {
    if (!inputText.trim()) return;

    setIsScanning(true);
    setAgents(prev => ({
      ...prev,
      security: { status: 'SCANNING', detail: 'Deep inspecting text...', isScanning: true },
      planner: { status: 'ROUTING', detail: 'Event detected, routing to filter...' },
      filter: { status: 'SCANNING', detail: 'Analyzing input with LLM...', isScanning: true },
      calendar: { status: 'WAITING', detail: 'Idle' }
    }));

    const newEvent = { 
      time: new Date().toLocaleTimeString('en-US', { hour12: false }), 
      source: "PLANNER", 
      text: `Processing: ${inputText.substring(0, 20)}...`, 
      type: "DEBUG" 
    };
    setEvents(prev => [...prev, newEvent]);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputText })
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect to API');
      }
      
      if (data.isPromptInjection) {
        setStats(s => ({ ...s, attacks: s.attacks + 1 }));
        setAgents(prev => ({
          ...prev,
          security: { status: 'THREAT DETECTED', detail: 'Blocked prompt injection attempt.', isScanning: false },
          planner: { status: 'ALERT', detail: 'Security violation detected' },
          filter: { status: 'BLOCKED', detail: 'Injection stopped.', isScanning: false }
        }));
        setEvents(prev => [...prev, {
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          source: "SECURITY",
          text: `Prompt Injection Detected`,
          type: "FLAGGED"
        }]);
      } else {
        setAgents(prev => ({
          ...prev,
          security: { status: 'WATCHING', detail: 'Monitoring for threats...', isScanning: false },
          planner: { status: 'ROUTED', detail: 'Task delegated' },
          filter: { status: 'IDLE', detail: `Classified as ${data.classification}`, isScanning: false }
        }));
        setEvents(prev => [...prev, {
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          source: "FILTER",
          text: `Classified: ${data.classification} | Action: ${data.action}`,
          type: "SAFE"
        }]);
        
        if (["important", "meeting_request", "task", "needs_reply"].includes(data.classification)) {
          setTasks(prev => [{
            id: Date.now(),
            text: inputText.substring(0, 30) + "...",
            status: data.classification === "meeting_request" ? "PENDING_AUTH" : "NEW",
            color: data.classification === "important" ? "bg-rose-500" : "bg-cyan-500",
            opacity: "",
            startTime: (data as any).meetingStartTime,
            endTime: (data as any).meetingEndTime
          }, ...prev]);

          if (data.classification === "meeting_request") {
            setTimeout(() => {
              setAgents(prev => ({
                ...prev,
                calendar: { status: 'PENDING_AUTH', detail: 'Waiting for user approval' }
              }));
              setEvents(prev => [...prev, {
                time: new Date().toLocaleTimeString('en-US', { hour12: false }),
                source: "CALENDAR",
                text: `Action Pending: User approval required for meeting`,
                type: "DEBUG"
              }]);
            }, 500);
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      setAgents(prev => ({
        ...prev,
        security: { status: 'ERROR', detail: 'Analysis failed.', isScanning: false },
        planner: { status: 'ERROR', detail: 'Failed to process event' },
        filter: { status: 'ERROR', detail: 'API connection failed', isScanning: false }
      }));
      setEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: "SYSTEM",
        text: `Error: ${error.message || 'API connection failed'}`,
        type: "FLAGGED"
      }]);
    } finally {
      setIsScanning(false);
      setInputText("");
    }
  };

  return (
    <div className="w-full min-h-screen lg:h-screen bg-[#050505] text-slate-300 flex flex-col font-sans overflow-y-auto lg:overflow-hidden border-2 sm:border-4 border-[#1A1A1A]">
      <header className="min-h-[70px] lg:h-20 border-b border-[#1A1A1A] flex flex-col sm:flex-row items-center justify-between p-4 lg:px-8 bg-[#0A0A0A] gap-4 shrink-0">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
          <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"></div>
          <h1 className="text-lg md:text-xl font-medium tracking-tight text-white text-center sm:text-left">
            SECURE <span className="text-cyan-500 font-bold">AMBIENT</span> ASSISTANT
          </h1>
          <span className="px-2 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400 border border-slate-700 tracking-widest font-mono uppercase">
            Dev-Prototype v1.0.4
          </span>
        </div>
        <div className="flex space-x-4 md:space-x-6 items-center text-[10px] md:text-xs font-mono">
          <div className="flex flex-col items-center sm:items-end">
            <span className="text-slate-500 uppercase">System Health</span>
            <span className="text-cyan-400 text-center sm:text-right">OPERATIONAL // 12ms Latency</span>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-slate-700 flex items-center justify-center shrink-0">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-[spin_3s_linear_infinite]"></div>
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto lg:overflow-hidden min-h-0">
        <section className="col-span-1 lg:col-span-8 flex flex-col gap-6 min-h-0 overflow-y-auto lg:overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
            <div className="bg-[#0F0F0F] border border-rose-900/30 p-4 rounded-lg shadow-[inset_0_0_12px_rgba(225,29,72,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rotate-45 translate-x-8 -translate-y-8"></div>
              <h3 className="text-[11px] uppercase tracking-wider text-rose-500 mb-2 font-semibold flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span>Security Agent</span>
              </h3>
              <p className="text-sm text-slate-200 font-mono">{agents.security.status}</p>
              <div className="mt-3 text-[10px] text-rose-400 leading-none">{agents.security.detail}</div>
            </div>
            <div className="bg-[#0F0F0F] border border-[#1F1F1F] p-4 rounded-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/5 rotate-45 translate-x-8 -translate-y-8"></div>
              <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">Planner Agent</h3>
              <p className="text-sm text-slate-200 font-mono">{agents.planner.status}</p>
              <div className="mt-3 text-[10px] text-cyan-400 leading-none">{agents.planner.detail}</div>
            </div>
            <div className="bg-[#0F0F0F] border border-cyan-900/30 p-4 rounded-lg shadow-[inset_0_0_12px_rgba(6,182,212,0.05)]">
              <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">Email Filter</h3>
              <p className="text-sm text-white font-mono flex items-center space-x-2">
                <span>{agents.filter.status}</span>
                {(agents.filter.isScanning || isGmailScanning) && (
                  <span className="flex space-x-1">
                    <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                )}
              </p>
              <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden relative">
                {(agents.filter.isScanning || isGmailScanning) ? (
                  <div className="absolute top-0 left-0 h-full bg-cyan-500 animate-[pulse_1.5s_ease-in-out_infinite]" style={{ width: '66%' }}></div>
                ) : (
                  <div className="absolute top-0 left-0 h-full bg-slate-700" style={{ width: '100%' }}></div>
                )}
              </div>
              <div className="mt-2 text-[9px] text-slate-500 font-mono">{agents.filter.detail}</div>
            </div>
            <div className="bg-[#0F0F0F] border border-[#1F1F1F] p-4 rounded-lg">
              <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">Calendar Agent</h3>
              <p className="text-sm text-slate-400 font-mono">{agents.calendar.status}</p>
              <div className="mt-3 text-[10px] text-slate-600 italic">{agents.calendar.detail}</div>
            </div>
            <div className="bg-[#0F0F0F] border border-[#1F1F1F] p-4 rounded-lg">
              <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">Summary Agent</h3>
              <p className="text-sm text-slate-400 font-mono">{agents.summary.status}</p>
              <div className="mt-3 text-[10px] text-slate-600 uppercase tracking-tighter">{agents.summary.detail}</div>
            </div>
          </div>

          {/* GMAIL SCANNER & INTEGRATION INTERFACE */}
          <div className="bg-[#0F0F0F] border border-[#1F1F1F] rounded-lg p-5 flex flex-col shrink-0">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1A1A1A]">
              <div className="flex items-center space-x-2">
                <div className="w-1 h-4 bg-cyan-500"></div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-200">Gmail Integration & Threat Scanner</h2>
              </div>
              {currentUser && (
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-900/40 px-2 py-0.5 rounded">
                    Connected: {currentUser.email}
                  </span>
                  <button 
                    onClick={handleSignOut}
                    className="text-[9px] text-slate-500 hover:text-rose-400 uppercase font-bold tracking-widest transition-colors cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            {needsAuth ? (
              <div className="py-4 flex flex-col items-center justify-center text-center space-y-3 bg-[#0C0C0C] rounded border border-[#1F1F1F] p-4">
                <svg className="w-8 h-8 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                </svg>
                <div className="space-y-1">
                  <p className="text-xs text-slate-300 font-bold">ربط المساعد الآمن مع حساب Gmail الخاص بك</p>
                  <p className="text-[10px] text-slate-500 max-w-md">قم بتسجيل الدخول بأمان لمسح رسائل البريد الإلكتروني الواردة وتصنيف المهام تلقائياً وفحص التهديدات الأمنية وهجمات حقن الأوامر.</p>
                </div>
                
                {/* Sign-in Button conforming to guidelines */}
                <button 
                  onClick={handleSignIn}
                  className="mt-2 flex items-center space-x-3 bg-white text-slate-800 hover:bg-slate-100 px-4 py-2 rounded font-bold text-xs shadow transition-all cursor-pointer border border-slate-300"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span className="text-slate-950">Sign in with Google</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-[#070707] border border-[#1F1F1F] p-3 rounded">
                  <div className="flex flex-col space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono">LIVE MAILBOX SCANNING</span>
                    <span className="text-xs text-slate-300 font-bold">انقر لفحص صندوق الرسائل الواردة الأخير</span>
                  </div>
                  <button
                    onClick={scanGmailInbox}
                    disabled={isGmailScanning}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded text-[11px] font-bold uppercase px-4 py-2 tracking-widest flex items-center space-x-2 transition-all cursor-pointer"
                  >
                    {isGmailScanning ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>جاري الفحص...</span>
                      </>
                    ) : (
                      <span>فحص البريد الوارد (Scan Inbox)</span>
                    )}
                  </button>
                </div>

                {gmailEmails.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider sticky top-0 bg-[#0F0F0F] py-2 border-b border-[#1A1A1A] z-10">
                      <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                      <span>Security Email Dashboard</span>
                    </div>
                    {gmailEmails.map((email) => {
                      const analysis = emailAnalyses[email.id];
                      let cardStyle = "bg-[#0A0A0A] border border-[#1F1F1F]";
                      let badgeStyle = "text-slate-500 bg-slate-900/40 border-slate-800";
                      let badgeText = "قيد الانتظار...";

                      if (analysis) {
                        if (analysis.isPromptInjection) {
                          cardStyle = "bg-rose-950/10 border-rose-900/50 hover:border-rose-700/60 text-rose-100 shadow-[inset_0_0_10px_rgba(239,68,68,0.05)]";
                          badgeStyle = "text-rose-400 bg-rose-950/60 border-rose-900/50";
                          badgeText = "🔴 خطر: محاولة اختراق (Prompt Injection Blocked)";
                        } else if (analysis.classification === 'spam') {
                          cardStyle = "bg-amber-950/10 border-amber-900/40 hover:border-amber-700/50 text-amber-100 shadow-[inset_0_0_10px_rgba(245,158,11,0.03)]";
                          badgeStyle = "text-amber-400 bg-amber-950/40 border-amber-900/40";
                          badgeText = "⚠️ بريد عشوائي (Spam)";
                        } else if (analysis.classification === 'important') {
                          cardStyle = "bg-violet-950/10 border-violet-900/40 hover:border-violet-700/50 text-violet-100 shadow-[inset_0_0_10px_rgba(139,92,246,0.03)]";
                          badgeStyle = "text-violet-400 bg-violet-950/40 border-violet-900/40";
                          badgeText = "⭐ هام وعاجل (Important)";
                        } else {
                          cardStyle = "bg-emerald-950/5 border-emerald-900/40 hover:border-emerald-700/50 text-emerald-100 shadow-[inset_0_0_10px_rgba(16,185,129,0.03)]";
                          badgeStyle = "text-emerald-400 bg-emerald-950/40 border-emerald-900/40";
                          badgeText = "🟢 آمن وسليم (Safe & Clean)";
                        }
                      }

                      return (
                        <div key={email.id} className={`${cardStyle} p-3 rounded flex flex-col space-y-2 transition-all text-xs border`}>
                          <div className="flex justify-between items-start">
                            <div className="font-bold text-[11px] truncate max-w-[260px] md:max-w-md">{email.subject}</div>
                            <span className="text-[9px] text-slate-500 shrink-0 font-mono">{email.from.substring(0, 30)}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{email.snippet}</p>
                          {analysis && (
                            <div className="flex items-center justify-between pt-1.5 border-t border-slate-900 mt-1">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${badgeStyle}`}>
                                {badgeText}
                              </span>
                              <span className="text-[9px] font-mono text-slate-500 uppercase">
                                Action: {analysis.action || 'تصنيف'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-[10px] text-slate-600 italic">
                    لم يتم إجراء فحص للبريد الإلكتروني بعد. انقر فوق الزر أعلاه للبدء.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DAILY SCHEDULED EMAIL LOGIC & STATUS */}
          <div className="bg-[#0F0F0F] border border-[#1F1F1F] rounded-lg p-5 flex flex-col shrink-0">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1A1A1A]">
              <div className="flex items-center space-x-2">
                <div className="w-1 h-4 bg-emerald-500"></div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-200">الجدولة التلقائية الذكية (Auto Scheduler)</h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${scheduleEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                <span className="text-[10px] text-slate-400 font-mono uppercase">
                  {scheduleEnabled ? 'ACTIVE LOOP (30 MIN)' : 'DISABLED'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed text-right">
                يقوم النظام تلقائياً <strong>كل نصف ساعة (30 دقيقة)</strong> بفحص آخر 20 رسالة في صندوق الوارد، ويتخطى الرسائل المفحوصة سابقاً لإرسال تقرير شامل. كما يعمل <strong>مراقب فوري (Watchdog) كل 15 ثانية (محاكاة للوقت الفعلي)</strong> لفحص الرسائل الجديدة مع وصولها وإرسال إشعارات مباشرة فورية في حال اكتشاف رسائل هامة جدًا أو تهديدات أمنية.
              </p>

              {currentUser ? (
                <div className="bg-[#0A0A0A] border border-[#1F1F1F] p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Countdown Display */}
                    <div className="flex flex-col space-y-1 text-right">
                      <label className="text-[10px] text-slate-500 font-mono">الفحص القادم خلال (Countdown)</label>
                      <div className="text-xl font-bold font-mono text-cyan-400">
                        {nextScanCountdown}
                      </div>
                    </div>

                    {/* Loop Toggle */}
                    <div className="flex flex-col items-end space-y-1 justify-center">
                      <span className="text-[10px] text-slate-500 font-mono">حالة الفحص التلقائي</span>
                      <button 
                        onClick={() => setScheduleEnabled(!scheduleEnabled)}
                        className={`text-[10px] font-bold px-3 py-1 rounded transition-all cursor-pointer ${
                          scheduleEnabled 
                            ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-400 hover:bg-emerald-900/40' 
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {scheduleEnabled ? 'مفعل (Enabled)' : 'معطل (Disabled)'}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-[#1A1A1A] pt-3 flex flex-col space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-mono font-bold">
                        {new Date().toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                      <span className="text-slate-500">الوقت الحالي للنظام:</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-cyan-400 font-mono">
                        {isAutoProcessing ? 'جاري التشغيل...' : schedulerStatus}
                      </span>
                      <span className="text-slate-500">حالة المجدول:</span>
                    </div>

                    {lastScanTime > 0 && (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400 font-mono">
                          {new Date(lastScanTime).toLocaleTimeString('en-US', { hour12: false })}
                        </span>
                        <span className="text-slate-500">آخر فحص تلقائي تم:</span>
                      </div>
                    )}
                  </div>

                  {/* Manual testing button */}
                  <div className="border-t border-[#1A1A1A] pt-3">
                    <button 
                      onClick={() => runScheduledDailyScan(true)}
                      disabled={isAutoProcessing}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-[11px] font-bold uppercase py-2 tracking-widest flex items-center justify-center space-x-2 transition-all cursor-pointer"
                    >
                      {isAutoProcessing ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>جاري الفحص وإرسال التقرير...</span>
                        </>
                      ) : (
                        <span>تشغيل الفحص والتقرير وإرساله الآن (Test Now)</span>
                      )}
                    </button>
                  </div>

                  {lastEmailSentStatus && (
                    <div className="bg-[#0C0C0C] border border-[#1A1A1A] p-2.5 rounded text-[10px] text-center font-mono text-emerald-400">
                      📬 {lastEmailSentStatus}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center bg-[#0C0C0C] border border-[#1F1F1F] rounded p-4 text-[11px] text-slate-500">
                  يرجى تسجيل الدخول بحساب Google لتفعيل الجدولة وإرسال التقارير التلقائية إلى بريدك.
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 bg-[#0F0F0F] border border-[#1F1F1F] rounded-lg flex flex-col overflow-hidden min-h-[280px] lg:min-h-0">
            <div className="px-4 py-3 border-b border-[#1F1F1F] flex justify-between items-center bg-[#0C0C0C]">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Ambient Event Log // Activity Feed</h2>
              <span className="text-[10px] text-slate-500 font-mono">{events.length} Items Processed</span>
            </div>
            <div className="flex-1 font-mono text-[11px] p-4 space-y-2 overflow-y-auto">
              {events.map((ev, idx) => {
                let borderStyle = "border-[#1A1A1A] text-slate-400";
                let badgeColor = "bg-slate-800 text-slate-500";
                
                if (ev.type === 'FLAGGED' || ev.text.toLowerCase().includes('prompt injection') || ev.text.toLowerCase().includes('blocked') || ev.text.toLowerCase().includes('violation')) {
                  borderStyle = "text-rose-400 bg-rose-500/5 border-rose-950/40";
                  badgeColor = "bg-rose-950/60 text-rose-300 border border-rose-900/50";
                } else if (ev.type === 'SAFE' || ev.text.toLowerCase().includes('classified') || ev.text.toLowerCase().includes('success') || ev.text.toLowerCase().includes('secure')) {
                  borderStyle = "text-green-400 bg-green-500/5 border-green-950/40";
                  badgeColor = "bg-green-950/60 text-green-300 border border-green-900/50";
                } else if (ev.type === 'DEBUG') {
                  borderStyle = "text-cyan-400/80 bg-cyan-500/5 border-cyan-950/40";
                  badgeColor = "bg-cyan-950/40 text-cyan-400 border border-cyan-900/40";
                }

                return (
                  <div key={idx} className={`flex items-start space-x-3 py-1.5 border-b ${borderStyle}`}>
                    <span className="shrink-0 text-[10px] opacity-70">[{ev.time}]</span>
                    <span className="flex-1 font-medium">[{ev.source}] {ev.text}</span>
                    <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded ${badgeColor}`}>{ev.type}</span>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-[#1F1F1F] bg-[#0A0A0A] flex gap-2">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && analyzeInput()}
                placeholder="Type an email or ambient event..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
              />
              <button 
                onClick={analyzeInput}
                disabled={isScanning}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded text-[11px] font-bold uppercase tracking-wider"
              >
                {isScanning ? 'Scanning...' : 'Inject Event'}
              </button>
            </div>
          </div>
        </section>
        <aside className="col-span-1 lg:col-span-4 flex flex-col gap-6 min-h-0 overflow-y-auto lg:overflow-hidden">
          {/* TASK STATUS ON TOP OF SIDEBAR */}
          <div className="flex-1 bg-[#0F0F0F] border border-[#1F1F1F] rounded-lg p-5 flex flex-col overflow-hidden min-h-[280px] lg:min-h-0">
            <div className="flex items-center space-x-2 mb-4 shrink-0">
              <div className="w-1 h-4 bg-slate-500"></div>
              <h2 className="text-xs font-bold uppercase tracking-widest">Task Status [Preview]</h2>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 mb-4">
              {tasks.map(task => (
                <div key={task.id} className={`flex items-center space-x-3 ${task.opacity}`}>
                  <div className={`w-2 h-2 rounded-full ${task.color} shrink-0`}></div>
                  <span className="text-xs text-slate-300 truncate flex-1">{task.text}</span>
                  {task.status === 'PENDING_AUTH' ? (
                    <button onClick={() => approveTask(task.id, task.text, task.startTime, task.endTime)} className="ml-auto px-2 py-0.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-[9px] transition-colors cursor-pointer border border-green-500/30 uppercase tracking-wider shrink-0">Approve</button>
                  ) : (
                    <div className="ml-auto flex items-center space-x-2 shrink-0">
                      <span className="text-[9px] text-slate-500">{task.status}</span>
                      {task.calendarLink && (
                        <a 
                          href={task.calendarLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="px-1.5 py-0.5 bg-cyan-950 text-cyan-400 hover:bg-cyan-900 border border-cyan-800 rounded text-[8px] font-bold uppercase transition-all"
                        >
                          Calendar
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-auto pt-4 space-y-3 shrink-0 border-t border-[#1F1F1F]">
              <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 p-2 rounded">
                 <span className="text-[10px] font-mono text-slate-500 uppercase">Save Path:</span>
                 <input 
                   type="text" 
                   defaultValue="./data/tasks.json" 
                   className="bg-transparent border-none text-[10px] font-mono text-cyan-400 outline-none text-right w-24 focus:w-full transition-all"
                 />
                 <button className="text-[9px] bg-slate-800 px-2 py-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors uppercase cursor-pointer ml-2">
                   Browse
                 </button>
              </div>
              <button 
                onClick={generateReport}
                disabled={isGeneratingReport}
                className="w-full py-2 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
              >
                {isGeneratingReport ? 'Generating...' : 'إنشاء تقرير يدوي (Manual Report)'}
              </button>
            </div>
          </div>

          {/* SECURITY SHIELD HUD AT THE BOTTOM OF SIDEBAR */}
          <div className="bg-[#0F0F0F] border border-[#1F1F1F] rounded-lg p-5 shrink-0">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-1 h-4 bg-cyan-500"></div>
              <h2 className="text-xs font-bold uppercase tracking-widest">Security Shield HUD</h2>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-mono">Semgrep Checks</span>
                <span className="text-xs font-mono text-green-500">{stats.errors} ERRORS</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-mono">Prompt Injections Blocked</span>
                <span className="text-xs font-mono text-rose-500">{stats.attacks} ATTACK</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-mono">Sensitive Redaction</span>
                <span className="text-xs font-mono text-cyan-500">{stats.redacted} FIELDS</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-mono">STRIDE Compliance</span>
                <span className="text-xs font-mono text-slate-300">SECURE</span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-[#1F1F1F]">
              <div className="text-[10px] text-slate-600 mb-2 uppercase">Active Security Hook</div>
              <div className="bg-slate-900 p-2 rounded text-[10px] font-mono text-slate-400 border border-slate-800 italic">
                .agents/hooks.json/validate_tool_call.py
              </div>
            </div>
          </div>
        </aside>
      </main>
      <footer className="min-h-12 border-t border-[#1A1A1A] flex flex-col sm:flex-row items-center justify-between p-3 sm:px-8 bg-[#0A0A0A] text-[9px] md:text-[10px] font-mono text-slate-600 shrink-0 gap-2">
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
          <span>PLATFORM: LOCAL ENVIRONMENT</span>
          <span className="text-slate-800 hidden sm:inline">|</span>
          <span>ENCRYPTED_AT_REST: TRUE</span>
        </div>
        <div className="text-center sm:text-right">PROTECTED BY STRIDE THREAT MODEL // PHASE: PROTOTYPE-DEPLOY</div>
      </footer>
      {showReportModal && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-[#0F0F0F] border border-[#1F1F1F] rounded-lg p-6 max-w-lg w-full flex flex-col space-y-4">
            <div className="flex justify-between items-center border-b border-[#1A1A1A] pb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">Daily Events Report</h2>
              <button onClick={() => setShowReportModal(false)} className="text-slate-500 hover:text-white cursor-pointer text-lg leading-none">&times;</button>
            </div>
            <div className="flex-1 max-h-96 overflow-y-auto font-mono text-[11px] space-y-2 p-2 bg-[#050505] rounded border border-[#1A1A1A]">
              {events.map((ev, idx) => {
                let textStyle = "text-slate-400 border-[#1A1A1A]";
                if (ev.type === 'FLAGGED' || ev.text.toLowerCase().includes('prompt injection') || ev.text.toLowerCase().includes('blocked') || ev.text.toLowerCase().includes('violation')) {
                  textStyle = "text-rose-400 bg-rose-500/5 border-rose-950/20";
                } else if (ev.type === 'SAFE' || ev.text.toLowerCase().includes('classified') || ev.text.toLowerCase().includes('success') || ev.text.toLowerCase().includes('secure')) {
                  textStyle = "text-green-400 bg-green-500/5 border-green-950/20";
                } else if (ev.type === 'DEBUG') {
                  textStyle = "text-cyan-400/80 bg-cyan-500/5 border-cyan-950/20";
                }
                return (
                  <div key={idx} className={`flex items-start space-x-3 py-1 border-b ${textStyle}`}>
                    <span className="shrink-0 opacity-70">[{ev.time}]</span>
                    <span className="flex-1">[{ev.source}] {ev.text}</span>
                  </div>
                );
              })}
            </div>

            {googleSheetUrl && (
              <div className="bg-green-950/40 border border-green-900/60 text-green-400 p-3 rounded text-xs flex flex-col space-y-2">
                <p className="font-semibold text-right">✓ تم تصدير التقرير بنجاح إلى Google Sheets مع حالة كل حدث!</p>
                <a 
                  href={googleSheetUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bg-green-600 hover:bg-green-500 text-white text-center rounded py-1.5 px-3 font-bold uppercase tracking-wider block transition-colors"
                >
                  افتح شيت جوجل (Open Google Sheet)
                </a>
              </div>
            )}

            {sheetError && (
              <div className="bg-rose-950/40 border border-rose-900/60 text-rose-400 p-3 rounded text-xs text-right">
                {sheetError}
              </div>
            )}

            <div className="pt-4 flex justify-end space-x-2">
              {accessToken ? (
                <button 
                  onClick={exportToGoogleSheets} 
                  disabled={isExportingToSheet}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {isExportingToSheet ? 'جاري التصدير...' : 'تصدير إلى Google Sheets'}
                </button>
              ) : (
                <button 
                  onClick={handleSignIn}
                  className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-slate-300 rounded text-[11px] font-bold uppercase tracking-wider cursor-pointer border border-[#333]"
                >
                  ربط Google لتفعيل الشيت
                </button>
              )}
              <button onClick={exportReport} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-bold uppercase tracking-wider cursor-pointer">تنزيل ملف Text</button>
              <button onClick={() => { setShowReportModal(false); setGoogleSheetUrl(null); setSheetError(null); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-bold uppercase tracking-wider cursor-pointer">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

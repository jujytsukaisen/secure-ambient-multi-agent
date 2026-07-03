const fs = require('fs');

const missingPart = `
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
              text: \`BLOCKED Prompt Injection in email "\${email.subject}" from \${email.from}\`,
              type: "FLAGGED"
            }]);
          } else {
            setAgents(prev => ({
              ...prev,
              security: { status: 'WATCHING', detail: 'Monitoring for threats...', isScanning: false },
              planner: { status: 'ROUTED', detail: \`Email processed successfully\` },
              filter: { status: 'IDLE', detail: \`Classified as \${data.classification}\`, isScanning: false }
            }));
            setEvents(prev => [...prev, {
              time: new Date().toLocaleTimeString('en-US', { hour12: false }),
              source: "FILTER",
              text: \`Classified email "\${email.subject}" as [\${data.classification}] | Priority: \${data.priority}\`,
              type: "SAFE"
            }]);

            setTasks(prev => [{
              id: Date.now() + Math.random(),
              text: \`Email: \${email.subject}\`,
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
        const emptyHtml = \`
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
        \`;
        const userEmail = currentUser?.email || "user@gmail.com";
        await sendEmailReport(accessToken, userEmail, "تقرير الفحص التلقائي - لا توجد رسائل جديدة", emptyHtml);
        
        setLastEmailSentStatus(\`تم الإرسال بنجاح إلى \${userEmail} (لا توجد رسائل جديدة للفحص)\`);
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
        text: \`From: \${email.from}\\nSubject: \${email.subject}\\nSnippet: \${email.snippet}\`
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
            throw new Error(\`API error: \${batchResponse.statusText}\`);
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
              text: \`[SCHEDULER BLOCK] Prompt Injection in email "\${email.subject}" from \${email.from}\`,
              type: "FLAGGED"
            }]);
          } else {
            safeCount++;
            setTasks(prev => {
              if (prev.some(t => t.text.includes(email.subject))) return prev;
              return [{
                id: Date.now() + Math.random(),
                text: \`Email: \${email.subject}\`,
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
        text: \`Email: \${item.email.subject} | Action: \${item.result.action}\`,
        type: item.result.isPromptInjection ? 'FLAGGED' as const : 'SAFE' as const
      }));

      let autoSpreadsheetUrl = '';
      try {
        autoSpreadsheetUrl = await createGoogleSheetReport(accessToken, sheetEventsForNewScan);
      } catch (err) {
        console.warn("Could not create google sheet for auto report:", err);
      }

      const emailRowsHtml = results.map(item => \`
        <div style="background-color: \${item.result.isPromptInjection ? '#3b0707' : '#111827'}; border: 1px solid \${item.result.isPromptInjection ? '#ef4444' : '#374151'}; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
          <h4 style="margin: 0 0 10px 0; color: \${item.result.isPromptInjection ? '#ef4444' : '#60a5fa'}; font-size: 15px;">
            \${item.result.isPromptInjection ? '⚠️ محاولة اختراق محجوبة' : '✅ رسالة آمنة'}
          </h4>
          <p style="margin: 5px 0; font-size: 13px; color: #d1d5db;"><strong>الموضوع:</strong> \${item.email.subject}</p>
          <p style="margin: 5px 0; font-size: 13px; color: #d1d5db;"><strong>المرسل:</strong> \${item.email.from}</p>
          <p style="margin: 5px 0; font-size: 13px; color: #d1d5db;"><strong>التصنيف:</strong> \${item.result.classification} | <strong>الأولوية:</strong> \${item.result.priority}</p>
          <p style="margin: 5px 0; font-size: 13px; color: #d1d5db;"><strong>الإجراء المتخذ:</strong> \${item.result.action}</p>
          <p style="margin: 5px 0; font-size: 13px; color: #9ca3af;"><strong>التفاصيل:</strong> \${item.result.details}</p>
        </div>
      \`).join('');

      const userEmail = currentUser?.email || "user@gmail.com";
      const reportHtml = \`
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; background-color: #0a0a0a; color: #eee; padding: 20px; border-radius: 8px;">
          <div style="background-color: #000; padding: 15px; border-radius: 6px; border: 1px solid #333; margin-bottom: 20px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px;">🛡️ تقرير فحص البريد والتهديدات التلقائي</h1>
            <p style="color: #06b6d4; font-size: 12px; margin: 5px 0 0 0; font-family: monospace;">SECURE AMBIENT ASSISTANT REPORT // AUTO LOOP (30 MIN)</p>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6;">مرحباً <strong>\${userEmail}</strong>،</p>
          <p style="font-size: 14px; line-height: 1.6;">تم تشغيل الفحص التلقائي للبريد الإلكتروني بنجاح (كل 30 دقيقة). أدناه تفاصيل التحليل الأمني وتصنيفات الرسائل الجديدة المكتشفة:</p>
          
          <div style="background-color: #161616; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #222;">
            <h3 style="color: #06b6d4; margin-top: 0; font-size: 15px; border-bottom: 1px solid #333; padding-bottom: 8px;">📊 ملخص الفحص الجديد</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: right;">
              <tr>
                <td style="padding: 6px 0; color: #9ca3af;">الرسائل الجديدة المكتشفة والمفحوصة:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #ffffff;">\${results.length}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #9ca3af;">هجمات حقن الأوامر المكتشفة والمحجوبة:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #ef4444;">\${injectionCount}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #9ca3af;">الرسائل الآمنة المكتشفة:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #10b981;">\${safeCount}</td>
              </tr>
            </table>
          </div>

          \${autoSpreadsheetUrl ? \`
          <div style="text-align: center; margin: 25px 0;">
            <a href="\${autoSpreadsheetUrl}" target="_blank" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 6px; font-size: 14px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2); text-align: center;">
              📊 افتح التقرير الكامل كملف Google Sheet
            </a>
          </div>
          \` : ''}
          
          <h3 style="color: #ffffff; font-size: 15px; margin-top: 25px; margin-bottom: 10px;">📨 تفاصيل الرسائل الجديدة المصنفة</h3>
          \${emailRowsHtml}
          
          <div style="margin-top: 30px; border-top: 1px solid #1f1f1f; padding-top: 15px; font-size: 11px; color: #6b7280; text-align: center;">
            هذا التقرير تم توليده وإرساله تلقائياً بواسطة المساعد الشخصي الذكي المستضاف بأمان.
          </div>
        </div>
      \`;

      // 4. Send Gmail report with Google Sheets link included
      await sendEmailReport(accessToken, userEmail, "تقرير فحص البريد التلقائي (30 دقيقة)", reportHtml);

      setEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: "SCHEDULER",
        text: \`Auto Report successfully emailed to \${userEmail} with Google Sheets Link!\`,
        type: "SAFE"
      }]);

      setLastEmailSentStatus(\`تم إرسال التقرير التلقائي مع شيت جوجل بنجاح إلى \${userEmail} في تمام الساعة \${new Date().toLocaleTimeString('en-US', { hour12: false })}\`);
    } catch (error: any) {
      console.error("Scheduled task error:", error);
      setEvents(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: "SCHEDULER",
        text: \`Scheduled scan failed: \${error.message}\`,
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
        setNextScanCountdown(\`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`);
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
        const unscannedEmails = fetched.filter(email => !emailAnalyses[email.id]);
        
        if (unscannedEmails.length === 0) return;

        const batchItems = unscannedEmails.map(email => ({
          id: email.id,
          text: \`From: \${email.from}\\nSubject: \${email.subject}\\nSnippet: \${email.snippet}\`
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
`;

let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  /const data = newAnalysesEntries\[email\.id\];/,
  missingPart + 'const data = newAnalysesEntries[email.id];'
);
fs.writeFileSync('src/App.tsx', code);

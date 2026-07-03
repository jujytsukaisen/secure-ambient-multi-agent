const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace the urgent scan loop part
code = code.replace(
  /const newAnalyses = \{ \.\.\.emailAnalyses \};\n\s*let newEvents: typeof events = \[\];\n\s*let newSpam = 0;\n\s*let newTasks = 0;\n\s*let newMeetings = 0;\n\s*let newAttacks = 0;\n\s*for \(const email of unscannedEmails\) \{/,
  `const newAnalysesEntries: Record<string, any> = {};
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

        for (const email of unscannedEmails) {`
);

code = code.replace(
  /newAnalyses\[email\.id\] = data;/,
  `const data = newAnalysesEntries[email.id];`
);

code = code.replace(
  /setEmailAnalyses\(newAnalyses\);/,
  ``
);

fs.writeFileSync('src/App.tsx', code);

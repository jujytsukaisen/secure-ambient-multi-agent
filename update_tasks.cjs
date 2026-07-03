const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Update interface
code = code.replace(
  /calendarLink\?: string;\n\}/,
  'calendarLink?: string;\n  startTime?: string;\n  endTime?: string;\n}'
);

// 2. Update approveTask signature and logic
code = code.replace(
  /const approveTask = async \(id: number, text: string\) => \{/,
  'const approveTask = async (id: number, text: string, startTime?: string, endTime?: string) => {'
);
code = code.replace(
  /const result = await createCalendarEvent\(accessToken, text, "Scheduled securely via Secure Ambient Assistant\."\);/,
  'const result = await createCalendarEvent(accessToken, text, "Scheduled securely via Secure Ambient Assistant.", startTime, endTime);'
);

// 3. Update the button onClick
code = code.replace(
  /<button onClick=\{\(\) => approveTask\(task.id, task.text\)\} className=/g,
  '<button onClick={() => approveTask(task.id, task.text, task.startTime, task.endTime)} className='
);

// 4. Update setTasks to add startTime, endTime (this one is a bit tricky, let's just do it with a regex carefully or string replace)
code = code.replace(
  /setTasks\(prev => \[\{\n\s*id: Date\.now\(\) \+ Math\.random\(\),\n\s*text: `Email: \$\{email\.subject\}`,\n\s*status: data\.classification === "meeting_request" \? "PENDING_AUTH" : data\.classification === "important" \? "REPLY_REQ" : "NEW",\n\s*color: data\.classification === "important" \? "bg-rose-500" : data\.classification === "meeting_request" \? "bg-cyan-500" : "bg-green-500",\n\s*opacity: ""\n\s*\}, \.\.\.prev\]\);/g,
  'setTasks(prev => [{\n              id: Date.now() + Math.random(),\n              text: `Email: ${email.subject}`,\n              status: data.classification === "meeting_request" ? "PENDING_AUTH" : data.classification === "important" ? "REPLY_REQ" : "NEW",\n              color: data.classification === "important" ? "bg-rose-500" : data.classification === "meeting_request" ? "bg-cyan-500" : "bg-green-500",\n              opacity: "",\n              startTime: (data as any).meetingStartTime,\n              endTime: (data as any).meetingEndTime\n            }, ...prev]);'
);

fs.writeFileSync('src/App.tsx', code);

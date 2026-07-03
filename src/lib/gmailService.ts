export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

export const fetchRecentEmails = async (accessToken: string, limit = 5): Promise<EmailMessage[]> => {
  try {
    const res = await fetch('/api/gmail/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, limit }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Gmail list failed: ${res.statusText}`);
    }

    const emails: EmailMessage[] = await res.json();
    return emails.filter(email => 
      !email.subject.includes("إشعار فوري: رسالة هامة تم رصدها") &&
      !email.subject.includes("تقرير الفحص التلقائي") &&
      !email.subject.includes("تنبيه أمني")
    );
  } catch (error: any) {
    if (error?.message === 'Failed to fetch') {
      console.warn('Network error fetching emails from Gmail proxy (server might be restarting or offline).');
    } else {
      console.error('Error fetching emails from Gmail proxy:', error);
    }
    throw error;
  }
};

/**
 * Sends a UTF-8 formatted HTML email report using Gmail API.
 */
export const sendEmailReport = async (
  accessToken: string,
  toEmail: string,
  subject: string,
  htmlBody: string
): Promise<void> => {
  try {
    const res = await fetch('/api/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, toEmail, subject, htmlBody }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Gmail API sending error: ${res.statusText}`);
    }
  } catch (error: any) {
    if (error?.message === 'Failed to fetch') {
      console.warn('Network error in sendEmailReport proxy (server might be restarting or offline).');
    } else {
      console.error('Error in sendEmailReport proxy:', error);
    }
    throw error;
  }
};

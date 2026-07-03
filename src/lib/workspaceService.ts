export interface AppEvent {
  time: string;
  source: string;
  text: string;
  type: 'SAFE' | 'FLAGGED' | 'DEBUG';
}

/**
 * Creates a Google Spreadsheet with the list of current ambient events.
 * Returns the spreadsheet URL for the user to open.
 */
export const createGoogleSheetReport = async (
  accessToken: string,
  events: AppEvent[]
): Promise<string> => {
  try {
    const res = await fetch('/api/sheets/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, events }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create spreadsheet: ${res.statusText}`);
    }

    const data = await res.json();
    return data.spreadsheetUrl;
  } catch (error) {
    console.error('Error creating Google Sheet via proxy:', error);
    throw error;
  }
};

/**
 * Creates a Google Calendar Event from an approved task or meeting request.
 */
export const createCalendarEvent = async (
  accessToken: string,
  title: string,
  description: string,
  startTime?: string,
  endTime?: string
): Promise<{ htmlLink: string }> => {
  try {
    const res = await fetch('/api/calendar/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, title, description, startTime, endTime }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create calendar event: ${res.statusText}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error creating Calendar event via proxy:', error);
    throw error;
  }
};

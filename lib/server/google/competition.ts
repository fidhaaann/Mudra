import { google } from 'googleapis';
import { getGoogleEnvVars } from '../security/env';
import { Event, ParticipantType, PointsCategory, EventStatus } from '@/types/event';
import { EventResult, PodiumPlacement } from '@/types/result';
import { TeamId } from '@/types/team';

function getSheetsClient() {
  const { email, privateKey } = getGoogleEnvVars();
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
}

export async function fetchEvents(): Promise<Event[]> {
  const { competitionSpreadsheetId } = getGoogleEnvVars();
  const sheets = getSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: competitionSpreadsheetId,
      range: 'EVENTS',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Assuming headers are on the first row, we map by index or find indices
    // Let's assume a fixed structure, but handle safely.
    // Normalize headers (replace underscores with spaces, lowercase, trim)
    const headers = rows[0].map((h: string) => String(h || '').toLowerCase().replace(/_/g, ' ').trim());
    
    // Find indices
    const idIdx = headers.findIndex(h => h === 'id' || h === 'event id' || h === 'eventid');
    const nameIdx = headers.findIndex(h => h === 'name' || h === 'event name');
    const categoryIdx = headers.findIndex(h => h === 'category');
    const partTypeIdx = headers.findIndex(h => h === 'participant type' || h === 'participanttype');
    const pointsCatIdx = headers.findIndex(h => h === 'points category' || h === 'pointscategory');
    const descIdx = headers.findIndex(h => h === 'description');
    const venueIdx = headers.findIndex(h => h === 'venue');
    const dateIdx = headers.findIndex(h => h === 'date');
    const startTimeIdx = headers.findIndex(h => h === 'start time' || h === 'starttime');
    const endTimeIdx = headers.findIndex(h => h === 'end time' || h === 'endtime');
    const scheduleIdx = headers.findIndex(h => h === 'schedule');
    const statusIdx = headers.findIndex(h => h === 'status');
    const imageIdx = headers.findIndex(h => h === 'image url' || h === 'imageurl');
    const regLinkIdx = headers.findIndex(h => h === 'registration link' || h === 'registration link' || h === 'registration open');

    const events: Event[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Ignore completely empty rows
      if (!row || row.length === 0 || row.every((cell: string) => !cell || String(cell).trim() === '')) {
        continue;
      }
      
      const id = idIdx >= 0 ? String(row[idIdx] || '').trim() : '';
      if (!id) continue; // Malformed row, needs ID

      const name = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
      const rawCategory = categoryIdx >= 0 ? String(row[categoryIdx] || '').trim().toLowerCase() : '';
      const rawPartType = partTypeIdx >= 0 ? String(row[partTypeIdx] || '').trim().toLowerCase() : '';
      const rawPointsCat = pointsCatIdx >= 0 ? String(row[pointsCatIdx] || '').trim().toLowerCase().replace(/[\s-]/g, '') : '';
      const rawStatus = statusIdx >= 0 ? String(row[statusIdx] || '').trim().toLowerCase() : 'upcoming';

      // Build schedule string if separate date/time columns exist
      let schedule = scheduleIdx >= 0 ? String(row[scheduleIdx] || '').trim() : '';
      if (!schedule && dateIdx >= 0 && row[dateIdx]) {
        const dateStr = String(row[dateIdx]).trim();
        const startStr = startTimeIdx >= 0 ? String(row[startTimeIdx] || '').trim() : '';
        const endStr = endTimeIdx >= 0 ? String(row[endTimeIdx] || '').trim() : '';
        schedule = startStr ? `${dateStr}, ${startStr}${endStr ? ` - ${endStr}` : ''}` : dateStr;
      }

      events.push({
        id,
        name,
        category: (rawCategory === 'off-stage' || rawCategory === 'offstage') ? 'off-stage' : 'on-stage',
        participantType: (rawPartType === 'duo' ? 'duo' : rawPartType === 'group' ? 'group' : 'solo') as ParticipantType,
        pointsCategory: (rawPointsCat === 'group' ? 'group' : rawPointsCat === 'duo' ? 'duo' : rawPointsCat === 'offstage' ? 'offstage' : 'solo') as PointsCategory,
        description: descIdx >= 0 && row[descIdx] ? String(row[descIdx]).trim() : undefined,
        venue: venueIdx >= 0 && row[venueIdx] ? String(row[venueIdx]).trim() : undefined,
        schedule: schedule || undefined,
        status: (rawStatus === 'completed' ? 'completed' : rawStatus === 'live' ? 'live' : 'upcoming') as EventStatus,
        imageUrl: imageIdx >= 0 && row[imageIdx] ? String(row[imageIdx]).trim() : undefined,
        registrationOpen: regLinkIdx >= 0 ? Boolean(row[regLinkIdx] && String(row[regLinkIdx]).trim() !== '' && String(row[regLinkIdx]).toLowerCase() !== 'false') : false,
      });
    }

    return events;
  } catch (error) {
    console.error('Error fetching events from Google Sheets:', error);
    throw new Error('Failed to retrieve events.');
  }
}

export async function fetchEvent(eventId: string): Promise<Event | null> {
  const events = await fetchEvents();
  return events.find(e => e.id.toLowerCase() === eventId.toLowerCase()) || null;
}

export async function fetchResults(): Promise<EventResult[]> {
  const { competitionSpreadsheetId } = getGoogleEnvVars();
  const sheets = getSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: competitionSpreadsheetId,
      range: 'RESULTS',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const headers = rows[0].map((h: string) => String(h || '').toLowerCase().replace(/_/g, ' ').trim());
    
    const eventIdIdx = headers.findIndex(h => h === 'event id' || h === 'eventid' || h === 'event');
    const placementIdx = headers.findIndex(h => h === 'position' || h === 'placement' || h === 'rank');
    const participantIdx = headers.findIndex(h => h === 'entry name' || h === 'entryname' || h === 'participant' || h === 'participant name' || h === 'name');
    const teamIdx = headers.findIndex(h => h === 'team' || h === 'team id');
    const pointsIdx = headers.findIndex(h => h === 'points' || h === 'points awarded');

    // Group by eventId
    const resultsMap = new Map<string, PodiumPlacement[]>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || row.every((cell: string) => !cell || String(cell).trim() === '')) {
        continue;
      }
      
      const eventId = eventIdIdx >= 0 ? String(row[eventIdIdx] || '').trim() : '';
      if (!eventId) continue; // Malformed row

      const placementStr = placementIdx >= 0 ? String(row[placementIdx] || '').trim() : '';
      const placement = parseInt(placementStr, 10);
      if (isNaN(placement) || (placement !== 1 && placement !== 2 && placement !== 3)) continue;
      
      const participantName = participantIdx >= 0 ? String(row[participantIdx] || '').trim() : '';
      const rawTeam = teamIdx >= 0 ? String(row[teamIdx] || '').trim().toLowerCase() : '';
      const teamId = (['raaga', 'agni', 'tarang', 'utsav'].includes(rawTeam) ? rawTeam : 'raaga') as TeamId;
      const points = pointsIdx >= 0 ? parseInt(String(row[pointsIdx] || '0').trim(), 10) : 0;

      const placementObj: PodiumPlacement = {
        placement: placement as 1 | 2 | 3,
        participantOrTeamName: participantName,
        teamId,
        pointsAwarded: isNaN(points) ? 0 : points,
      };

      const existing = resultsMap.get(eventId) || [];
      existing.push(placementObj);
      resultsMap.set(eventId, existing);
    }

    const events = await fetchEvents();
    
    const results: EventResult[] = [];
    
    for (const [eventId, placements] of resultsMap.entries()) {
      const event = events.find(e => e.id.toLowerCase() === eventId.toLowerCase());
      // Only expose results publicly when corresponding event STATUS is COMPLETED
      if (event && event.status === 'completed') {
        // Sort placements by 1, 2, 3
        placements.sort((a, b) => a.placement - b.placement);
        results.push({
          eventId: event.id,
          placements,
          isDemoData: false,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error fetching results from Google Sheets:', error);
    throw new Error('Failed to retrieve results.');
  }
}

export async function fetchEventResults(eventId: string): Promise<EventResult | null> {
  const results = await fetchResults();
  return results.find(r => r.eventId === eventId) || null;
}

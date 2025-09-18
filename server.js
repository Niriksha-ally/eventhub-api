const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

// Ensure data file exists
async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(EVENTS_FILE);
  } catch {
    await fs.writeFile(EVENTS_FILE, '[]', 'utf8');
  }
}

// -------- Serve frontend --------
app.use(express.static(path.join(__dirname, 'public')));

// -------- GET all events --------
app.get('/api/events', async (req, res) => {
  try {
    await ensureDataFile();
    const raw = await fs.readFile(EVENTS_FILE, 'utf8');
    const events = JSON.parse(raw || '[]');
    res.json(events);
  } catch (err) {
    console.error('GET /api/events error:', err);
    res.status(500).json({ error: 'Failed to read events' });
  }
});

// -------- Create new event --------
app.post('/api/events', async (req, res) => {
  try {
    const { title, description, date, location, maxAttendees } = req.body;

    if (!title || !date || !location || maxAttendees === undefined) {
      return res.status(400).json({ error: 'Missing required fields: title, date, location, maxAttendees' });
    }

    const max = Number(maxAttendees);
    if (!Number.isInteger(max) || max <= 0) {
      return res.status(400).json({ error: 'maxAttendees must be a positive integer' });
    }

    const newEvent = {
      eventId: 'EVT-' + Date.now(),
      title,
      description: description || '',
      date,
      location,
      maxAttendees: max,
      currentAttendees: 0,
      status: 'upcoming',
      attendees: []
    };

    await ensureDataFile();
    const raw = await fs.readFile(EVENTS_FILE, 'utf8');
    const events = JSON.parse(raw || '[]');
    events.push(newEvent);
    await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf8');

    res.status(201).json(newEvent);
  } catch (err) {
    console.error('POST /api/events error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// -------- Register attendee --------
app.post('/api/events/:id/register', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Missing required fields: name, email' });
    }

    await ensureDataFile();
    const raw = await fs.readFile(EVENTS_FILE, 'utf8');
    const events = JSON.parse(raw || '[]');

    const event = events.find(e => e.eventId === req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.currentAttendees >= event.maxAttendees) {
      return res.status(400).json({ error: 'Event is full' });
    }

    const attendee = { id: 'ATT-' + Date.now(), name, email };
    event.attendees.push(attendee);
    event.currentAttendees++;

    await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf8');

    res.status(201).json({ message: 'Registered successfully', attendee });
  } catch (err) {
    console.error('POST /api/events/:id/register error:', err);
    res.status(500).json({ error: 'Failed to register attendee' });
  }
});

// -------- Start server --------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`EventHub API + Frontend listening on http://localhost:${PORT}`));

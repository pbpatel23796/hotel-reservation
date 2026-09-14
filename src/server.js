import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db.js';
import {
  checkAvailability,
  calculatePrice,
  createBooking,
  cancelBooking,
  getBooking,
  listBookings,
  getResource,
  listResources,
  getAvailableDates
} from './bookingLogic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

initializeDatabase();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/resources', (req, res) => {
  try {
    const resources = listResources();
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/resources/:id', (req, res) => {
  try {
    const resource = getResource(parseInt(req.params.id));
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/availability/check', (req, res) => {
  try {
    const { resourceId, checkIn, checkOut } = req.body;

    if (!resourceId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const available = checkAvailability(resourceId, checkIn, checkOut);
    res.json({ available, checkIn, checkOut, resourceId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/price/calculate', (req, res) => {
  try {
    const { resourceId, checkIn, checkOut, numGuests = 1 } = req.body;

    if (!resourceId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pricing = calculatePrice(resourceId, checkIn, checkOut, numGuests);
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings', (req, res) => {
  try {
    const { resourceId, guestName, guestEmail, checkIn, checkOut, numGuests = 1 } = req.body;

    if (!resourceId || !guestName || !guestEmail || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const booking = createBooking(resourceId, guestName, guestEmail, checkIn, checkOut, numGuests);
    res.status(201).json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/bookings', (req, res) => {
  try {
    const resourceId = req.query.resourceId ? parseInt(req.query.resourceId) : null;
    const bookings = listBookings(resourceId);
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bookings/:id', (req, res) => {
  try {
    const booking = getBooking(parseInt(req.params.id));
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings/:id/cancel', (req, res) => {
  try {
    const result = cancelBooking(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/availability/dates', (req, res) => {
  try {
    const { resourceId, startDate, endDate } = req.query;

    if (!resourceId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const available = getAvailableDates(parseInt(resourceId), startDate, endDate);
    res.json({ available, resourceId: parseInt(resourceId), startDate, endDate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Hotel Reservation API running on http://localhost:${PORT}`);
});

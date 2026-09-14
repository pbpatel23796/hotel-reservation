import db from './db.js';

const CANCELLATION_FEE_PERCENT = 15;

export function checkAvailability(resourceId, checkIn, checkOut) {
  const checkInDate = new Date(checkIn).toISOString();
  const checkOutDate = new Date(checkOut).toISOString();

  const conflicts = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE resource_id = ?
      AND status = 'confirmed'
      AND (
        (check_in < ? AND check_out > ?)
        OR (check_in < ? AND check_out >= ?)
      )
  `).get(resourceId, checkOutDate, checkInDate, checkOutDate, checkInDate);

  return conflicts.count === 0;
}

export function calculatePrice(resourceId, checkIn, checkOut, numGuests = 1) {
  const resource = db.prepare('SELECT hourly_rate FROM resources WHERE id = ?').get(resourceId);
  if (!resource) throw new Error('Resource not found');

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  // BUG #1: Off-by-one error in night calculation
  // Should be: Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
  // But it's using Math.floor which loses fractional nights
  const nights = Math.floor((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

  const basePrice = nights * resource.hourly_rate;

  // BUG #2: Discount stacking bug - applies discount multiple times
  let discount = 0;

  // Long-stay discount (7+ nights = 10% off)
  if (nights >= 7) {
    discount += basePrice * 0.1;
  }

  // Group discount (3+ guests = 5% off)
  if (numGuests >= 3) {
    discount += basePrice * 0.05;
  }

  // Early booking discount (booked 30+ days in advance = 5% off)
  const daysUntilCheckin = (checkInDate - new Date()) / (1000 * 60 * 60 * 24);
  if (daysUntilCheckin >= 30) {
    discount += basePrice * 0.05;
  }

  const totalPrice = Math.max(basePrice - discount, 0);

  return {
    basePrice: parseFloat(basePrice.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    totalPrice: parseFloat(totalPrice.toFixed(2))
  };
}

export function createBooking(resourceId, guestName, guestEmail, checkIn, checkOut, numGuests = 1) {
  // Check availability
  if (!checkAvailability(resourceId, checkIn, checkOut)) {
    throw new Error('Resource is not available for the selected dates');
  }

  const pricing = calculatePrice(resourceId, checkIn, checkOut, numGuests);

  const stmt = db.prepare(`
    INSERT INTO bookings (
      resource_id, guest_name, guest_email, check_in, check_out,
      num_guests, base_price, discount_amount, total_price, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    resourceId,
    guestName,
    guestEmail,
    checkIn,
    checkOut,
    numGuests,
    pricing.basePrice,
    pricing.discount,
    pricing.totalPrice,
    'confirmed'
  );

  return {
    id: result.lastInsertRowid,
    ...pricing,
    status: 'confirmed'
  };
}

export function cancelBooking(bookingId) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.status === 'cancelled') throw new Error('Booking already cancelled');

  const checkInDate = new Date(booking.check_in);
  const now = new Date();
  const daysUntilCheckIn = (checkInDate - now) / (1000 * 60 * 60 * 24);

  let refundAmount = booking.total_price;
  let cancellationFee = 0;

  // BUG #3: Cancellation fee calculation is inverted
  // Should charge fee if less than 7 days before check-in
  // But the logic is backwards
  if (daysUntilCheckIn >= 7) {
    cancellationFee = booking.total_price * (CANCELLATION_FEE_PERCENT / 100);
  }

  refundAmount -= cancellationFee;

  const stmt = db.prepare(`
    UPDATE bookings
    SET status = ?, cancellation_fee = ?
    WHERE id = ?
  `);

  stmt.run('cancelled', cancellationFee, bookingId);

  return {
    bookingId,
    originalPrice: booking.total_price,
    cancellationFee,
    refundAmount: Math.max(refundAmount, 0)
  };
}

export function getBooking(bookingId) {
  return db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
}

export function listBookings(resourceId = null) {
  let query = 'SELECT * FROM bookings WHERE status = ? ORDER BY check_in DESC';
  const params = ['confirmed'];

  if (resourceId) {
    query = 'SELECT * FROM bookings WHERE resource_id = ? AND status = ? ORDER BY check_in DESC';
    params.unshift(resourceId);
  }

  return db.prepare(query).all(...params);
}

export function getResource(resourceId) {
  return db.prepare('SELECT * FROM resources WHERE id = ?').get(resourceId);
}

export function listResources() {
  return db.prepare('SELECT * FROM resources ORDER BY name').all();
}

export function getAvailableDates(resourceId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const unavailableDates = db.prepare(`
    SELECT check_in, check_out FROM bookings
    WHERE resource_id = ? AND status = 'confirmed'
      AND check_in < ? AND check_out > ?
  `).all(resourceId, end.toISOString(), start.toISOString());

  const available = [];
  let current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const isBooked = unavailableDates.some(booking => {
      const ciDate = new Date(booking.check_in);
      const coDate = new Date(booking.check_out);
      // BUG #4: Date comparison uses >= instead of >, causing off-by-one
      // Should be: current >= ciDate && current < coDate
      return current > ciDate && current < coDate;
    });

    if (!isBooked) {
      available.push(dateStr);
    }

    current.setDate(current.getDate() + 1);
  }

  return available;
}

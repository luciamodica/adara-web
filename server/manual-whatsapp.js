import {db} from './db.js';

const frontend = () => process.env.FRONTEND_URL || 'http://localhost:5173';
const dateLabel = date => date.split('-').reverse().join('/');
const digits = phone => String(phone || '').replace(/\D/g, '');

// Preparation only: no provider calls, notification jobs or delivery status writes.
export function manualReminder(business, bookingId) {
  const booking = db.prepare(`SELECT bk.*, c.name client_name, c.phone client_phone
    FROM bookings bk JOIN clients c ON c.id=bk.client_id AND c.business_id=bk.business_id
    WHERE bk.id=? AND bk.business_id=?`).get(bookingId, business.id);
  if (!booking) throw new Error('No encontramos ese turno en tu negocio.');
  if (booking.status !== 'confirmed') throw new Error('Los recordatorios se preparan para turnos confirmados.');
  if (Date.parse(`${booking.date}T${booking.start_time}:00-03:00`) <= Date.now()) {
    throw new Error('Ese turno ya comenzó. Elegí un próximo turno.');
  }
  if (!booking.manage_token) throw new Error('Este turno no tiene enlace privado.');
  const url = `${frontend()}/mi-reserva/${booking.manage_token}`;
  return {
    phone: digits(booking.client_phone),
    client: booking.client_name,
    date: booking.date,
    time: booking.start_time,
    text: `Hola ${booking.client_name}, te recordamos tu turno en ${business.name} el ${dateLabel(booking.date)} a las ${booking.start_time}.\n${booking.selection_summary ? `Servicio: ${booking.selection_summary}.\n` : ''}\nPodés confirmar tu asistencia, reprogramar o cancelar desde tu enlace privado:\n${url}`
  };
}

export function manualWaitlist(business, waitlistId, availabilityFor, staffCanDoServices) {
  const entry = db.prepare('SELECT * FROM waitlist WHERE id=? AND business_id=?').get(waitlistId, business.id);
  if (!entry) throw new Error('No encontramos esa solicitud en tu negocio.');
  if (!business.waitlist_enabled || !business.show_booking || !['waiting', 'notified'].includes(entry.status) || !entry.consent_at) {
    throw new Error('Esta solicitud ya no está disponible para avisar.');
  }
  const services = JSON.parse(entry.service_ids_json).map(id => db.prepare('SELECT * FROM services WHERE id=? AND business_id=? AND active=1').get(id, business.id));
  if (!services.length || services.some(service => !service)) throw new Error('Los servicios de esta solicitud ya no están disponibles.');
  if (entry.staff_id && (!db.prepare('SELECT 1 FROM staff WHERE id=? AND business_id=? AND active=1').get(entry.staff_id, business.id) || !staffCanDoServices(entry.staff_id, services.map(service => service.id)))) {
    throw new Error('El profesional de esta solicitud ya no está disponible.');
  }
  const slots = availabilityFor({business, date: entry.date, services, partySize: entry.party_size, staffId: entry.staff_id})
    .filter(time => Date.parse(`${entry.date}T${time}:00-03:00`) > Date.now());
  if (!slots.length) throw new Error('Todavía no hay horarios disponibles para esta solicitud.');
  const url = `${frontend()}/reservar/${business.slug}`;
  return {
    phone: digits(entry.phone), client: entry.name, date: entry.date, time: slots[0],
    text: `Hola ${entry.name}, se liberó un lugar en ${business.name} el ${dateLabel(entry.date)} a las ${slots[0]}.\nServicio: ${services.map(service => service.name).join(' + ')}.\n\nPodés ver los horarios y reservar desde:\n${url}\n\nEl aviso no guarda el horario; la disponibilidad se confirma al reservar.`
  };
}

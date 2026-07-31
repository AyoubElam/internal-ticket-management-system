import type {
  User, Zone, Ticket, Comment, Intervention,
  Notification, ActivityLog, KpiStats
} from './types'

export const mockZones: Zone[] = [
  { id: 1, name: 'Casablanca Centre', region: 'Grand Casablanca', createdAt: '2024-01-01T00:00:00Z' },
  { id: 2, name: 'Rabat Agdal',       region: 'Rabat-Salé-Kénitra', createdAt: '2024-01-01T00:00:00Z' },
  { id: 3, name: 'Marrakech Gueliz',  region: 'Marrakech-Safi', createdAt: '2024-01-01T00:00:00Z' },
  { id: 4, name: 'Fès Médina',        region: 'Fès-Meknès', createdAt: '2024-01-01T00:00:00Z' },
  { id: 5, name: 'Tanger Ville',      region: 'Tanger-Tétouan-Al Hoceïma', createdAt: '2024-01-01T00:00:00Z' },
  { id: 6, name: 'Agadir Centre',     region: 'Souss-Massa', createdAt: '2024-01-01T00:00:00Z' },
]

export const mockUsers: User[] = [
  { id: 1, email: 'admin@wifimaroc.ma',     firstName: 'Youssef',    lastName: 'El Mansouri', role: 'admin',         zoneId: null, isActive: true, createdAt: '2024-01-01T00:00:00Z' },
  { id: 2, email: 'agent1@wifimaroc.ma',    firstName: 'Sara',       lastName: 'Benali',      role: 'support_agent', zoneId: 1,    isActive: true, createdAt: '2024-01-15T00:00:00Z' },
  { id: 3, email: 'agent2@wifimaroc.ma',    firstName: 'Khalid',     lastName: 'Tazi',        role: 'support_agent', zoneId: 2,    isActive: true, createdAt: '2024-01-15T00:00:00Z' },
  { id: 4, email: 'tech1@wifimaroc.ma',     firstName: 'Omar',       lastName: 'Chraibi',     role: 'technician',    zoneId: 1,    isActive: true, createdAt: '2024-02-01T00:00:00Z' },
  { id: 5, email: 'tech2@wifimaroc.ma',     firstName: 'Amine',      lastName: 'Ouali',       role: 'technician',    zoneId: 3,    isActive: true, createdAt: '2024-02-01T00:00:00Z' },
  { id: 6, email: 'tech3@wifimaroc.ma',     firstName: 'Hassan',     lastName: 'Mouni',       role: 'technician',    zoneId: 2,    isActive: true, createdAt: '2024-02-15T00:00:00Z' },
  { id: 7, email: 'emp1@wifimaroc.ma',      firstName: 'Fatima',     lastName: 'Zahra',       role: 'employee',      zoneId: 1,    isActive: true, createdAt: '2024-03-01T00:00:00Z' },
  { id: 8, email: 'emp2@wifimaroc.ma',      firstName: 'Mehdi',      lastName: 'Alaoui',      role: 'employee',      zoneId: 2,    isActive: true, createdAt: '2024-03-01T00:00:00Z' },
  { id: 9, email: 'emp3@wifimaroc.ma',      firstName: 'Nadia',      lastName: 'Berrada',     role: 'employee',      zoneId: 3,    isActive: false, createdAt: '2024-03-10T00:00:00Z' },
]

// Passwords for demo (all = "Password123!")
export const DEMO_PASSWORDS: Record<string, string> = {
  'admin@wifimaroc.ma':  'Password123!',
  'agent1@wifimaroc.ma': 'Password123!',
  'agent2@wifimaroc.ma': 'Password123!',
  'tech1@wifimaroc.ma':  'Password123!',
  'tech2@wifimaroc.ma':  'Password123!',
  'tech3@wifimaroc.ma':  'Password123!',
  'emp1@wifimaroc.ma':   'Password123!',
  'emp2@wifimaroc.ma':   'Password123!',
}

export const mockTickets: Ticket[] = [
  {
    id: 1,  title: 'Internet outage in Casablanca office',      description: 'All users in the main Casablanca office are unable to connect to the internet since 9 AM. Router shows no WAN link.', category: 'network_support',    priority: 'critical', status: 'in_progress', createdById: 7, assignedToId: 4, zoneId: 1, createdAt: '2025-07-28T09:15:00Z', updatedAt: '2025-07-28T10:30:00Z', resolvedAt: null, commentsCount: 3,
  },
  {
    id: 2,  title: 'Request for new laptop — Marketing dept',   description: 'I need a new laptop for my daily work. My current one is 5 years old and very slow.',                                   category: 'equipment_request',  priority: 'medium',   status: 'assigned',    createdById: 8, assignedToId: 2, zoneId: 2, createdAt: '2025-07-27T14:00:00Z', updatedAt: '2025-07-27T16:45:00Z', resolvedAt: null, commentsCount: 1,
  },
  {
    id: 3,  title: 'VPN access required for remote work',       description: 'I need VPN credentials to be able to work from home. My current account does not have VPN access.',                     category: 'system_access',      priority: 'high',     status: 'resolved',    createdById: 7, assignedToId: 3, zoneId: 1, createdAt: '2025-07-26T08:00:00Z', updatedAt: '2025-07-26T15:00:00Z', resolvedAt: '2025-07-26T15:00:00Z', commentsCount: 2,
  },
  {
    id: 4,  title: 'Network switch failure — Rabat server room', description: 'The main network switch in Rabat has failed. Multiple servers are unreachable.',                                         category: 'field_intervention', priority: 'critical', status: 'created',     createdById: 8, assignedToId: null, zoneId: 2, createdAt: '2025-07-29T07:30:00Z', updatedAt: '2025-07-29T07:30:00Z', resolvedAt: null, commentsCount: 0,
  },
  {
    id: 5,  title: 'Slow internet in Marrakech branch',         description: 'Internet speed is extremely slow since yesterday afternoon. Downloads are capped at 1 Mbps.',                           category: 'network_support',    priority: 'high',     status: 'assigned',    createdById: 9, assignedToId: 5, zoneId: 3, createdAt: '2025-07-28T13:00:00Z', updatedAt: '2025-07-28T14:30:00Z', resolvedAt: null, commentsCount: 2,
  },
  {
    id: 6,  title: 'Printer not working — Admin floor',         description: 'The HP LaserJet on the 3rd floor is not printing. Shows offline in the system.',                                         category: 'equipment_request',  priority: 'low',      status: 'closed',      createdById: 7, assignedToId: 2, zoneId: 1, createdAt: '2025-07-25T10:00:00Z', updatedAt: '2025-07-25T16:30:00Z', resolvedAt: '2025-07-25T16:30:00Z', commentsCount: 4,
  },
  {
    id: 7,  title: 'ERP access revoked after password change',  description: 'After changing my Active Directory password, I can no longer log into the ERP system.',                                  category: 'system_access',      priority: 'high',     status: 'in_progress', createdById: 8, assignedToId: 3, zoneId: 2, createdAt: '2025-07-29T09:00:00Z', updatedAt: '2025-07-29T10:15:00Z', resolvedAt: null, commentsCount: 1,
  },
  {
    id: 8,  title: 'Fiber cable cut — Agadir zone',             description: 'A fiber cable was accidentally cut during construction work near our Agadir office.',                                    category: 'field_intervention', priority: 'critical', status: 'in_progress', createdById: 7, assignedToId: 4, zoneId: 6, createdAt: '2025-07-29T06:00:00Z', updatedAt: '2025-07-29T08:45:00Z', resolvedAt: null, commentsCount: 5,
  },
  {
    id: 9,  title: 'Monitor replacement needed',                description: 'My monitor has a broken backlight and the screen is barely visible.',                                                    category: 'equipment_request',  priority: 'medium',   status: 'created',     createdById: 9, assignedToId: null, zoneId: 3, createdAt: '2025-07-29T11:00:00Z', updatedAt: '2025-07-29T11:00:00Z', resolvedAt: null, commentsCount: 0,
  },
  {
    id: 10, title: 'Wi-Fi dead zones in Fès office',            description: 'Several meeting rooms on the 2nd floor have no Wi-Fi coverage.',                                                         category: 'network_support',    priority: 'medium',   status: 'resolved',    createdById: 8, assignedToId: 6, zoneId: 4, createdAt: '2025-07-24T14:00:00Z', updatedAt: '2025-07-27T11:00:00Z', resolvedAt: '2025-07-27T11:00:00Z', commentsCount: 3,
  },
]

export const mockComments: Comment[] = [
  { id: 1, ticketId: 1, userId: 2, content: 'Technician dispatched to site. ETA 30 minutes.', isInternal: false, createdAt: '2025-07-28T10:30:00Z' },
  { id: 2, ticketId: 1, userId: 4, content: 'On site. Identified faulty WAN port on main router.', isInternal: false, createdAt: '2025-07-28T11:45:00Z' },
  { id: 3, ticketId: 1, userId: 4, content: 'Internal note: Need spare router from warehouse (SKU: RT-3200).', isInternal: true, createdAt: '2025-07-28T12:00:00Z' },
  { id: 4, ticketId: 2, userId: 2, content: 'Procurement request submitted. Expected delivery: 3-5 business days.', isInternal: false, createdAt: '2025-07-27T16:45:00Z' },
  { id: 5, ticketId: 3, userId: 3, content: 'VPN credentials have been created and sent to your email.', isInternal: false, createdAt: '2025-07-26T15:00:00Z' },
  { id: 6, ticketId: 3, userId: 7, content: 'Thanks, received the credentials. Everything works now!', isInternal: false, createdAt: '2025-07-26T15:30:00Z' },
]

export const mockInterventions: Intervention[] = [
  { id: 1, ticketId: 1, technicianId: 4, status: 'in_progress', notes: 'Replacing faulty WAN router. Parts ordered.', createdAt: '2025-07-28T10:30:00Z', updatedAt: '2025-07-28T12:00:00Z' },
  { id: 2, ticketId: 8, technicianId: 4, status: 'traveling',   notes: 'En route to Agadir. Estimated arrival: 14:00.', createdAt: '2025-07-29T08:45:00Z', updatedAt: '2025-07-29T09:00:00Z' },
  { id: 3, ticketId: 5, technicianId: 5, status: 'in_progress', notes: 'Diagnosing bandwidth throttling on uplink port.', createdAt: '2025-07-28T14:30:00Z', updatedAt: '2025-07-28T15:00:00Z' },
  { id: 4, ticketId: 10, technicianId: 6, status: 'completed',  notes: 'Installed 2 additional Wi-Fi access points. Coverage issue resolved.', createdAt: '2025-07-25T09:00:00Z', updatedAt: '2025-07-27T11:00:00Z' },
]

export const mockNotifications: Notification[] = [
  { id: 1,  userId: 7, message: 'Your ticket #1 has been assigned to a technician.',          isRead: false, createdAt: '2025-07-28T10:30:00Z' },
  { id: 2,  userId: 7, message: 'Technician Omar Chraibi is now on site for ticket #1.',      isRead: false, createdAt: '2025-07-28T11:45:00Z' },
  { id: 3,  userId: 7, message: 'Your ticket #3 has been resolved.',                          isRead: true,  createdAt: '2025-07-26T15:00:00Z' },
  { id: 4,  userId: 8, message: 'Your ticket #2 has been assigned.',                          isRead: true,  createdAt: '2025-07-27T16:45:00Z' },
  { id: 5,  userId: 2, message: 'New critical ticket #4 requires immediate attention.',       isRead: false, createdAt: '2025-07-29T07:30:00Z' },
  { id: 6,  userId: 1, message: 'SLA breach warning: Ticket #4 unassigned for over 2 hours.', isRead: false, createdAt: '2025-07-29T09:30:00Z' },
  { id: 7,  userId: 4, message: 'New intervention assigned: Ticket #8 (Agadir).',             isRead: false, createdAt: '2025-07-29T08:45:00Z' },
]

export const mockActivityLogs: ActivityLog[] = [
  { id: 1, userId: 7, action: 'CREATE_TICKET', entityType: 'ticket', entityId: 1, details: 'Created ticket: Internet outage in Casablanca office', createdAt: '2025-07-28T09:15:00Z' },
  { id: 2, userId: 2, action: 'ASSIGN_TICKET', entityType: 'ticket', entityId: 1, details: 'Assigned ticket #1 to Omar Chraibi', createdAt: '2025-07-28T10:30:00Z' },
  { id: 3, userId: 4, action: 'UPDATE_STATUS', entityType: 'ticket', entityId: 1, details: 'Changed status from assigned → in_progress', createdAt: '2025-07-28T11:45:00Z' },
  { id: 4, userId: 3, action: 'RESOLVE_TICKET', entityType: 'ticket', entityId: 3, details: 'Ticket #3 marked as resolved', createdAt: '2025-07-26T15:00:00Z' },
  { id: 5, userId: 1, action: 'CREATE_USER', entityType: 'user', entityId: 9, details: 'Created user account: Nadia Berrada (employee)', createdAt: '2025-03-10T09:00:00Z' },
]

export const mockKpiStats: KpiStats = {
  totalTickets: 10,
  openTickets: 7,
  resolvedToday: 1,
  avgResolutionHours: 14.5,
  criticalOpen: 3,
  slaCompliance: 72,
  byCategory: [
    { category: 'network_support',    count: 3 },
    { category: 'field_intervention', count: 2 },
    { category: 'equipment_request',  count: 3 },
    { category: 'system_access',      count: 2 },
  ],
  byStatus: [
    { status: 'created',     count: 2 },
    { status: 'assigned',    count: 2 },
    { status: 'in_progress', count: 3 },
    { status: 'resolved',    count: 2 },
    { status: 'closed',      count: 1 },
  ],
  byPriority: [
    { priority: 'low',      count: 1 },
    { priority: 'medium',   count: 3 },
    { priority: 'high',     count: 3 },
    { priority: 'critical', count: 3 },
  ],
  ticketsOverTime: [
    { date: 'Jul 23', created: 2, resolved: 1 },
    { date: 'Jul 24', created: 3, resolved: 2 },
    { date: 'Jul 25', created: 1, resolved: 3 },
    { date: 'Jul 26', created: 2, resolved: 1 },
    { date: 'Jul 27', created: 2, resolved: 1 },
    { date: 'Jul 28', created: 4, resolved: 2 },
    { date: 'Jul 29', created: 3, resolved: 1 },
  ],
}

// Enrich helpers
export function enrichTicket(t: Ticket): Ticket {
  return {
    ...t,
    createdBy: mockUsers.find(u => u.id === t.createdById),
    assignedTo: t.assignedToId ? mockUsers.find(u => u.id === t.assignedToId) : undefined,
    zone: t.zoneId ? mockZones.find(z => z.id === t.zoneId) : undefined,
  }
}

export function enrichIntervention(i: Intervention): Intervention {
  return {
    ...i,
    ticket: mockTickets.find(t => t.id === i.ticketId),
    technician: mockUsers.find(u => u.id === i.technicianId),
  }
}

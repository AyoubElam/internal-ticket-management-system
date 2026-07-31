-- =============================================================
-- SIGDI — Seed Data
-- All passwords = "Password123!"
-- Hash generated with: bcrypt.hash('Password123!', 12)
-- =============================================================

USE sigdi;

-- =============================================================
-- ZONES
-- =============================================================
INSERT INTO zones (id, name, region) VALUES
  (1, 'Casablanca Centre',  'Grand Casablanca'),
  (2, 'Rabat Agdal',        'Rabat-Salé-Kénitra'),
  (3, 'Marrakech Gueliz',   'Marrakech-Safi'),
  (4, 'Fès Médina',         'Fès-Meknès'),
  (5, 'Tanger Ville',       'Tanger-Tétouan-Al Hoceïma'),
  (6, 'Agadir Centre',      'Souss-Massa');

-- =============================================================
-- USERS  (password_hash = bcrypt hash of "Password123!")
-- =============================================================
INSERT INTO users
  (id, email, password_hash, first_name, last_name, role, zone_id, is_active)
VALUES
  (1, 'admin@wifimaroc.ma',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0G1AJbTKhm',
   'Youssef', 'El Mansouri', 'admin', NULL, 1),

  (2, 'agent1@wifimaroc.ma',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0G1AJbTKhm',
   'Sara', 'Benali', 'support_agent', 1, 1),

  (3, 'agent2@wifimaroc.ma',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0G1AJbTKhm',
   'Khalid', 'Tazi', 'support_agent', 2, 1),

  (4, 'tech1@wifimaroc.ma',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0G1AJbTKhm',
   'Omar', 'Chraibi', 'technician', 1, 1),

  (5, 'tech2@wifimaroc.ma',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0G1AJbTKhm',
   'Amine', 'Ouali', 'technician', 3, 1),

  (6, 'tech3@wifimaroc.ma',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0G1AJbTKhm',
   'Hassan', 'Mouni', 'technician', 2, 1),

  (7, 'emp1@wifimaroc.ma',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0G1AJbTKhm',
   'Fatima', 'Zahra', 'employee', 1, 1),

  (8, 'emp2@wifimaroc.ma',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0G1AJbTKhm',
   'Mehdi', 'Alaoui', 'employee', 2, 1),

  (9, 'emp3@wifimaroc.ma',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0G1AJbTKhm',
   'Nadia', 'Berrada', 'employee', 3, 0);

-- =============================================================
-- TICKETS
-- =============================================================
INSERT INTO tickets
  (id, title, description, category, priority, status,
   created_by_id, assigned_to_id, zone_id, created_at, updated_at, resolved_at)
VALUES
  (1,
   'Internet outage in Casablanca office',
   'All users in the main Casablanca office are unable to connect to the internet since 9 AM. Router shows no WAN link.',
   'network_support', 'critical', 'in_progress',
   7, 4, 1,
   '2025-07-28 09:15:00', '2025-07-28 10:30:00', NULL),

  (2,
   'Request for new laptop — Marketing dept',
   'I need a new laptop for my daily work. My current one is 5 years old and very slow.',
   'equipment_request', 'medium', 'assigned',
   8, 2, 2,
   '2025-07-27 14:00:00', '2025-07-27 16:45:00', NULL),

  (3,
   'VPN access required for remote work',
   'I need VPN credentials to be able to work from home. My current account does not have VPN access.',
   'system_access', 'high', 'resolved',
   7, 3, 1,
   '2025-07-26 08:00:00', '2025-07-26 15:00:00', '2025-07-26 15:00:00'),

  (4,
   'Network switch failure — Rabat server room',
   'The main network switch in Rabat has failed. Multiple servers are unreachable.',
   'field_intervention', 'critical', 'created',
   8, NULL, 2,
   '2025-07-29 07:30:00', '2025-07-29 07:30:00', NULL),

  (5,
   'Slow internet in Marrakech branch',
   'Internet speed is extremely slow since yesterday afternoon. Downloads are capped at 1 Mbps.',
   'network_support', 'high', 'assigned',
   9, 5, 3,
   '2025-07-28 13:00:00', '2025-07-28 14:30:00', NULL),

  (6,
   'Printer not working — Admin floor',
   'The HP LaserJet on the 3rd floor is not printing. Shows offline in the system.',
   'equipment_request', 'low', 'closed',
   7, 2, 1,
   '2025-07-25 10:00:00', '2025-07-25 16:30:00', '2025-07-25 16:30:00'),

  (7,
   'ERP access revoked after password change',
   'After changing my Active Directory password, I can no longer log into the ERP system.',
   'system_access', 'high', 'in_progress',
   8, 3, 2,
   '2025-07-29 09:00:00', '2025-07-29 10:15:00', NULL),

  (8,
   'Fiber cable cut — Agadir zone',
   'A fiber cable was accidentally cut during construction work near our Agadir office.',
   'field_intervention', 'critical', 'in_progress',
   7, 4, 6,
   '2025-07-29 06:00:00', '2025-07-29 08:45:00', NULL),

  (9,
   'Monitor replacement needed',
   'My monitor has a broken backlight and the screen is barely visible.',
   'equipment_request', 'medium', 'created',
   9, NULL, 3,
   '2025-07-29 11:00:00', '2025-07-29 11:00:00', NULL),

  (10,
   'Wi-Fi dead zones in Fès office',
   'Several meeting rooms on the 2nd floor have no Wi-Fi coverage.',
   'network_support', 'medium', 'resolved',
   8, 6, 4,
   '2025-07-24 14:00:00', '2025-07-27 11:00:00', '2025-07-27 11:00:00');

-- =============================================================
-- COMMENTS
-- =============================================================
INSERT INTO comments (id, ticket_id, user_id, content, is_internal, created_at) VALUES
  (1, 1, 2, 'Technician dispatched to site. ETA 30 minutes.',                         0, '2025-07-28 10:30:00'),
  (2, 1, 4, 'On site. Identified faulty WAN port on main router.',                    0, '2025-07-28 11:45:00'),
  (3, 1, 4, 'Internal note: Need spare router from warehouse (SKU: RT-3200).',         1, '2025-07-28 12:00:00'),
  (4, 2, 2, 'Procurement request submitted. Expected delivery: 3-5 business days.',   0, '2025-07-27 16:45:00'),
  (5, 3, 3, 'VPN credentials have been created and sent to your email.',              0, '2025-07-26 15:00:00'),
  (6, 3, 7, 'Thanks, received the credentials. Everything works now!',                0, '2025-07-26 15:30:00'),
  (7, 5, 5, 'Arrived at site, testing uplink bandwidth. Will update shortly.',        0, '2025-07-28 15:30:00'),
  (8, 7, 3, 'Resetting AD token sync. Should resolve in 30 minutes.',                 0, '2025-07-29 10:15:00'),
  (9, 8, 4, 'En route to Agadir. Road construction confirmed near site.',              0, '2025-07-29 09:00:00'),
  (10, 10, 6, 'Installed 2 additional Ubiquiti APs. Coverage tests passed.',           0, '2025-07-27 11:00:00');

-- =============================================================
-- INTERVENTIONS
-- =============================================================
INSERT INTO interventions (id, ticket_id, technician_id, status, notes, created_at, updated_at) VALUES
  (1, 1,  4, 'in_progress', 'Replacing faulty WAN router. Parts ordered.',                   '2025-07-28 10:30:00', '2025-07-28 12:00:00'),
  (2, 8,  4, 'traveling',   'En route to Agadir. Estimated arrival: 14:00.',                  '2025-07-29 08:45:00', '2025-07-29 09:00:00'),
  (3, 5,  5, 'in_progress', 'Diagnosing bandwidth throttling on uplink port.',                '2025-07-28 14:30:00', '2025-07-28 15:00:00'),
  (4, 10, 6, 'completed',   'Installed 2 additional Wi-Fi access points. Coverage resolved.', '2025-07-25 09:00:00', '2025-07-27 11:00:00');

-- =============================================================
-- NOTIFICATIONS
-- =============================================================
INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES
  (1, 7, 'Your ticket #1 has been assigned to a technician.',            0, '2025-07-28 10:30:00'),
  (2, 7, 'Technician Omar Chraibi is now on site for ticket #1.',        0, '2025-07-28 11:45:00'),
  (3, 7, 'Your ticket #3 has been resolved.',                            1, '2025-07-26 15:00:00'),
  (4, 8, 'Your ticket #2 has been assigned.',                            1, '2025-07-27 16:45:00'),
  (5, 2, 'New critical ticket #4 requires immediate attention.',         0, '2025-07-29 07:30:00'),
  (6, 1, 'SLA breach warning: Ticket #4 unassigned for over 2 hours.',  0, '2025-07-29 09:30:00'),
  (7, 4, 'New intervention assigned: Ticket #8 (Agadir).',               0, '2025-07-29 08:45:00');

-- =============================================================
-- ACTIVITY LOGS
-- =============================================================
INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES
  (1, 7, 'CREATE_TICKET',      'ticket', 1,  'Created ticket: Internet outage in Casablanca office',    '2025-07-28 09:15:00'),
  (2, 2, 'ASSIGN_TICKET',      'ticket', 1,  'Assigned ticket #1 to Omar Chraibi',                      '2025-07-28 10:30:00'),
  (3, 4, 'UPDATE_STATUS',      'ticket', 1,  'Changed status: assigned → in_progress',                  '2025-07-28 11:45:00'),
  (4, 3, 'RESOLVE_TICKET',     'ticket', 3,  'Ticket #3 marked as resolved',                            '2025-07-26 15:00:00'),
  (5, 1, 'CREATE_USER',        'user',   9,  'Created user account: Nadia Berrada (employee)',           '2024-03-10 09:00:00'),
  (6, 2, 'CREATE_INTERVENTION','intervention', 1, 'Intervention created for ticket #1',                 '2025-07-28 10:30:00');

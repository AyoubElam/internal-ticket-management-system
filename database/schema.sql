-- =============================================================
-- SIGDI — Système Intelligent de Gestion des Demandes Internes
-- Database Schema  (MySQL 8.0+)
-- =============================================================

CREATE DATABASE IF NOT EXISTS sigdi
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sigdi;

-- =============================================================
-- 1. ZONES
-- =============================================================
CREATE TABLE IF NOT EXISTS zones (
  id         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120)    NOT NULL,
  region     VARCHAR(120)    NOT NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_zone_name (name)
) ENGINE=InnoDB;

-- =============================================================
-- 2. USERS
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255)   NOT NULL,
  password_hash VARCHAR(255)   NOT NULL,
  first_name    VARCHAR(80)    NOT NULL,
  last_name     VARCHAR(80)    NOT NULL,
  role          ENUM(
    'admin',
    'support_agent',
    'technician',
    'employee'
  )                            NOT NULL DEFAULT 'employee',
  zone_id       INT UNSIGNED       NULL,
  is_active     TINYINT(1)     NOT NULL DEFAULT 1,
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_email (email),
  CONSTRAINT fk_user_zone
    FOREIGN KEY (zone_id) REFERENCES zones (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================
-- 3. TICKETS
-- =============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id             INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  title          VARCHAR(255)   NOT NULL,
  description    TEXT           NOT NULL,
  category       ENUM(
    'network_support',
    'field_intervention',
    'equipment_request',
    'system_access'
  )                             NOT NULL,
  priority       ENUM(
    'low',
    'medium',
    'high',
    'critical'
  )                             NOT NULL DEFAULT 'medium',
  status         ENUM(
    'created',
    'assigned',
    'in_progress',
    'resolved',
    'closed'
  )                             NOT NULL DEFAULT 'created',
  created_by_id  INT UNSIGNED   NOT NULL,
  assigned_to_id INT UNSIGNED       NULL,
  zone_id        INT UNSIGNED       NULL,
  created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at    TIMESTAMP          NULL,
  PRIMARY KEY (id),
  KEY idx_ticket_status   (status),
  KEY idx_ticket_priority (priority),
  KEY idx_ticket_category (category),
  KEY idx_ticket_created  (created_at),
  KEY idx_ticket_zone     (zone_id),
  CONSTRAINT fk_ticket_created_by
    FOREIGN KEY (created_by_id)  REFERENCES users (id),
  CONSTRAINT fk_ticket_assigned_to
    FOREIGN KEY (assigned_to_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_ticket_zone
    FOREIGN KEY (zone_id)        REFERENCES zones (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================
-- 4. COMMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS comments (
  id          INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  ticket_id   INT UNSIGNED   NOT NULL,
  user_id     INT UNSIGNED   NOT NULL,
  content     TEXT           NOT NULL,
  is_internal TINYINT(1)     NOT NULL DEFAULT 0,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comment_ticket (ticket_id),
  CONSTRAINT fk_comment_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_user
    FOREIGN KEY (user_id)   REFERENCES users   (id)
) ENGINE=InnoDB;

-- =============================================================
-- 5. INTERVENTIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS interventions (
  id             INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  ticket_id      INT UNSIGNED   NOT NULL,
  technician_id  INT UNSIGNED   NOT NULL,
  status         ENUM(
    'traveling',
    'in_progress',
    'completed'
  )                             NOT NULL DEFAULT 'traveling',
  notes          TEXT               NULL,
  created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_intervention_ticket (ticket_id),
  KEY idx_intervention_tech   (technician_id),
  CONSTRAINT fk_intervention_ticket
    FOREIGN KEY (ticket_id)     REFERENCES tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_intervention_tech
    FOREIGN KEY (technician_id) REFERENCES users   (id)
) ENGINE=InnoDB;

-- =============================================================
-- 6. NOTIFICATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED   NOT NULL,
  message    VARCHAR(500)   NOT NULL,
  is_read    TINYINT(1)     NOT NULL DEFAULT 0,
  created_at TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id),
  CONSTRAINT fk_notif_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================
-- 7. ACTIVITY LOGS
-- =============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id          INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED   NOT NULL,
  action      VARCHAR(80)    NOT NULL,
  entity_type VARCHAR(40)    NOT NULL,
  entity_id   INT UNSIGNED   NOT NULL,
  details     TEXT               NULL,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_log_user   (user_id),
  KEY idx_log_entity (entity_type, entity_id),
  CONSTRAINT fk_log_user
    FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

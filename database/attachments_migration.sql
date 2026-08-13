-- =============================================================
-- Migration: Add ticket_attachments table
-- Run this against your sigdi database
-- =============================================================

USE sigdi;

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  ticket_id     INT UNSIGNED   NOT NULL,
  uploaded_by   INT UNSIGNED   NOT NULL,
  file_name     VARCHAR(255)   NOT NULL,   -- original name shown to users
  stored_name   VARCHAR(255)   NOT NULL,   -- uuid-based name on disk
  file_path     VARCHAR(500)   NOT NULL,   -- relative path under /uploads
  file_size     INT UNSIGNED   NOT NULL,   -- bytes
  mime_type     VARCHAR(127)   NOT NULL,
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_att_ticket (ticket_id),
  KEY idx_att_uploader (uploaded_by),
  CONSTRAINT fk_att_ticket
    FOREIGN KEY (ticket_id)   REFERENCES tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_att_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users   (id)
) ENGINE=InnoDB;

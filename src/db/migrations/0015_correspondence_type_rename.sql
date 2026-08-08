-- Rename correspondence types: قادمة → صادر, واردة → وارد
ALTER TABLE correspondences DROP CONSTRAINT IF EXISTS correspondences_type_check;

UPDATE correspondences SET type = 'صادر' WHERE type = 'قادمة';
UPDATE correspondences SET type = 'وارد' WHERE type = 'واردة';

ALTER TABLE correspondences ADD CONSTRAINT correspondences_type_check CHECK (type IN ('صادر', 'وارد'));

ALTER TABLE users
    ADD COLUMN sex             SMALLINT,
    ADD COLUMN home_country    VARCHAR(2),
    ADD COLUMN current_city    VARCHAR(255),
    ADD COLUMN current_country VARCHAR(2);

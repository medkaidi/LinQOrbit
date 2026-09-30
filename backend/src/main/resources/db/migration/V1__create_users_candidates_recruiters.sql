CREATE TABLE users (
    id            UUID         NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name    VARCHAR(255) NOT NULL,
    last_name     VARCHAR(255) NOT NULL,
    phone         VARCHAR(255),
    status        SMALLINT     NOT NULL DEFAULT 1,
    created_at    TIMESTAMP    NOT NULL,
    updated_at    TIMESTAMP    NOT NULL,
    CONSTRAINT pk_users       PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX ix_users_status     ON users (status);
CREATE INDEX ix_users_created_at ON users (created_at);

CREATE TABLE candidates (
    id         UUID      NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT pk_candidates       PRIMARY KEY (id),
    CONSTRAINT fk_candidates_users FOREIGN KEY (id) REFERENCES users (id)
);

CREATE TABLE recruiters (
    id         UUID      NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT pk_recruiters       PRIMARY KEY (id),
    CONSTRAINT fk_recruiters_users FOREIGN KEY (id) REFERENCES users (id)
);

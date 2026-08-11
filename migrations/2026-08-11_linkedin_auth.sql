-- LinkedIn OAuth token store for the social poster (single-row).
-- The connect flow (/api/social/linkedin/callback) writes access + refresh + expiry here;
-- getLinkedInToken() auto-refreshes the access token before it expires (~60 days).
IF OBJECT_ID('dbo.LinkedIn_Auth', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.LinkedIn_Auth (
    id                int            NOT NULL CONSTRAINT PK_LinkedIn_Auth PRIMARY KEY,
    access_token      nvarchar(max)  NOT NULL,
    refresh_token     nvarchar(max)  NULL,
    expires_at        datetime2      NOT NULL,           -- access-token expiry (UTC)
    organization_urn  nvarchar(100)  NULL,               -- urn:li:organization:<id>
    updated_at        datetime2      NOT NULL CONSTRAINT DF_LinkedIn_Auth_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_LinkedIn_Auth_single CHECK (id = 1)    -- enforce a single row
  );
END

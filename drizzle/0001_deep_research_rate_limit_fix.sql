-- Create the table if it doesn't exist (initial setup)
CREATE TABLE IF NOT EXISTS "deep_research_usage" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL,
    "interaction_id" text,
    "request_id" text NOT NULL,
    "status" text NOT NULL DEFAULT 'pending',
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone
);
--> statement-breakpoint

-- Add new columns if table already exists (migration path)
ALTER TABLE "deep_research_usage"
ADD COLUMN IF NOT EXISTS "request_id" text,
ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'completed' NOT NULL,
ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint

-- Backfill existing records with unique request_ids (they're already "completed")
UPDATE "deep_research_usage"
SET request_id = id::text,
    status = 'completed',
    completed_at = created_at
WHERE request_id IS NULL;
--> statement-breakpoint

-- Make request_id NOT NULL after backfill
ALTER TABLE "deep_research_usage"
ALTER COLUMN "request_id" SET NOT NULL;
--> statement-breakpoint

-- Add unique constraint for idempotency
ALTER TABLE "deep_research_usage"
ADD CONSTRAINT "deep_research_usage_request_id_key" UNIQUE ("request_id");
--> statement-breakpoint

-- Add indexes
CREATE INDEX IF NOT EXISTS "idx_deep_research_usage_user_created"
ON "deep_research_usage" USING btree ("user_id", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_deep_research_usage_status"
ON "deep_research_usage" USING btree ("status");
--> statement-breakpoint

-- Atomic reserve function using INSERT...SELECT (works with connection pooling)
-- This is a single statement so it's atomic without advisory locks
CREATE OR REPLACE FUNCTION reserve_deep_research_usage(
    p_user_id text,
    p_workspace_id uuid,
    p_request_id text,
    p_limit integer DEFAULT 2,
    p_window_ms bigint DEFAULT 86400000
)
RETURNS TABLE(
    allowed boolean,
    remaining integer,
    reset_at timestamptz,
    usage_id uuid,
    was_duplicate boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_window_start timestamptz;
    v_current_count integer;
    v_oldest_timestamp timestamptz;
    v_reset_at timestamptz;
    v_usage_id uuid;
    v_existing record;
BEGIN
    v_window_start := NOW() - (p_window_ms || ' milliseconds')::interval;

    -- Check for existing request (idempotency) - this is a read, safe with pooling
    SELECT id, status INTO v_existing
    FROM deep_research_usage
    WHERE request_id = p_request_id;

    IF v_existing.id IS NOT NULL THEN
        -- Return info about the existing reservation
        SELECT COUNT(*)::integer INTO v_current_count
        FROM deep_research_usage
        WHERE user_id = p_user_id
        AND created_at >= v_window_start
        AND status != 'failed';

        RETURN QUERY
        SELECT
            TRUE as allowed,
            GREATEST(0, p_limit - v_current_count)::integer as remaining,
            NULL::timestamptz as reset_at,
            v_existing.id as usage_id,
            TRUE as was_duplicate;
        RETURN;
    END IF;

    -- Atomic INSERT...SELECT - this is a single statement, atomic even with pooling
    -- Only inserts if count < limit
    INSERT INTO deep_research_usage (user_id, workspace_id, request_id, status)
    SELECT p_user_id, p_workspace_id, p_request_id, 'pending'
    WHERE (
        SELECT COUNT(*)
        FROM deep_research_usage
        WHERE user_id = p_user_id
        AND created_at >= v_window_start
        AND status != 'failed'
    ) < p_limit
    RETURNING id INTO v_usage_id;

    -- If insert succeeded
    IF v_usage_id IS NOT NULL THEN
        SELECT COUNT(*)::integer INTO v_current_count
        FROM deep_research_usage
        WHERE user_id = p_user_id
        AND created_at >= v_window_start
        AND status != 'failed';

        RETURN QUERY
        SELECT
            TRUE as allowed,
            GREATEST(0, p_limit - v_current_count)::integer as remaining,
            NULL::timestamptz as reset_at,
            v_usage_id as usage_id,
            FALSE as was_duplicate;
        RETURN;
    END IF;

    -- Insert failed because limit reached - get reset time
    SELECT MIN(created_at) INTO v_oldest_timestamp
    FROM deep_research_usage
    WHERE user_id = p_user_id
    AND created_at >= v_window_start
    AND status != 'failed';

    IF v_oldest_timestamp IS NOT NULL THEN
        v_reset_at := v_oldest_timestamp + (p_window_ms || ' milliseconds')::interval;
        IF v_reset_at <= NOW() THEN
            v_reset_at := NOW() + interval '1 minute';
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        FALSE as allowed,
        0 as remaining,
        v_reset_at as reset_at,
        NULL::uuid as usage_id,
        FALSE as was_duplicate;
END;
$$;
--> statement-breakpoint

-- Function to complete a reservation (update with real interactionId)
CREATE OR REPLACE FUNCTION complete_deep_research_usage(
    p_usage_id uuid,
    p_interaction_id text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE deep_research_usage
    SET
        status = 'completed',
        interaction_id = p_interaction_id,
        completed_at = NOW()
    WHERE id = p_usage_id
    AND status = 'pending';

    RETURN FOUND;
END;
$$;
--> statement-breakpoint

-- Function to fail/rollback a reservation
CREATE OR REPLACE FUNCTION fail_deep_research_usage(
    p_usage_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE deep_research_usage
    SET status = 'failed'
    WHERE id = p_usage_id
    AND status = 'pending';

    RETURN FOUND;
END;
$$;
--> statement-breakpoint

-- Optional: Cleanup function for old failed reservations (can be run via cron)
CREATE OR REPLACE FUNCTION cleanup_failed_deep_research_reservations(
    p_older_than_hours integer DEFAULT 24
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted integer;
BEGIN
    DELETE FROM deep_research_usage
    WHERE status = 'failed'
    AND created_at < NOW() - (p_older_than_hours || ' hours')::interval;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

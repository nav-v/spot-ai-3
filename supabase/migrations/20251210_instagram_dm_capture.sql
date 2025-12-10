-- Instagram DM Capture Feature
-- Tables for linking Instagram accounts and tracking ingested links

-- Table to store Instagram account linkings
CREATE TABLE public.instagram_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,  -- Spot user ID (matches places.user_id)
  ig_user_id TEXT NOT NULL UNIQUE,  -- Instagram User ID (IGSID)
  ig_username TEXT,  -- Instagram username (for display)
  access_token TEXT,  -- Long-lived Page/User access token (encrypted in production)
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT[],  -- Granted permissions
  linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table to store ingested links from DMs
CREATE TABLE public.ingested_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_user_id TEXT NOT NULL,  -- Spot user ID
  ig_user_id TEXT NOT NULL,  -- Instagram user who sent the DM
  source_channel TEXT NOT NULL DEFAULT 'instagram_dm',
  url TEXT NOT NULL,
  url_type TEXT NOT NULL CHECK (url_type IN ('ig_reel', 'ig_post', 'ig_story', 'external')),
  
  -- Metadata fetched from the URL
  metadata JSONB DEFAULT '{}',  -- { title, caption, thumbnail, author, etc. }
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'saved', 'error_unfetchable', 'error_private', 'error_other')),
  error_message TEXT,
  
  -- Link to saved place (if successfully created)
  saved_place_id TEXT,
  
  -- Webhook data for debugging
  webhook_message_id TEXT,  -- Instagram message ID
  raw_webhook_payload JSONB,  -- Full webhook payload for debugging
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT fk_spot_user FOREIGN KEY (spot_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Dead letter queue for failed webhook processing
CREATE TABLE public.instagram_webhook_dlq (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  is_resolved BOOLEAN NOT NULL DEFAULT false
);

-- Indexes for efficient lookups
CREATE INDEX idx_instagram_accounts_user_id ON public.instagram_accounts(user_id);
CREATE INDEX idx_instagram_accounts_ig_user_id ON public.instagram_accounts(ig_user_id);
CREATE INDEX idx_ingested_links_spot_user_id ON public.ingested_links(spot_user_id);
CREATE INDEX idx_ingested_links_ig_user_id ON public.ingested_links(ig_user_id);
CREATE INDEX idx_ingested_links_status ON public.ingested_links(status);
CREATE INDEX idx_ingested_links_created_at ON public.ingested_links(created_at);
CREATE INDEX idx_webhook_dlq_unresolved ON public.instagram_webhook_dlq(is_resolved) WHERE NOT is_resolved;

-- Enable RLS
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingested_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_webhook_dlq ENABLE ROW LEVEL SECURITY;

-- RLS Policies (for now, allow access - tighten in production)
CREATE POLICY "Users can view their own Instagram accounts" ON public.instagram_accounts
  FOR SELECT USING (true);
CREATE POLICY "Users can insert their own Instagram accounts" ON public.instagram_accounts
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own Instagram accounts" ON public.instagram_accounts
  FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own Instagram accounts" ON public.instagram_accounts
  FOR DELETE USING (true);

CREATE POLICY "Users can view their own ingested links" ON public.ingested_links
  FOR SELECT USING (true);
CREATE POLICY "System can insert ingested links" ON public.ingested_links
  FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update ingested links" ON public.ingested_links
  FOR UPDATE USING (true);

CREATE POLICY "System can manage DLQ" ON public.instagram_webhook_dlq
  FOR ALL USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for instagram_accounts
CREATE TRIGGER update_instagram_accounts_updated_at
  BEFORE UPDATE ON public.instagram_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


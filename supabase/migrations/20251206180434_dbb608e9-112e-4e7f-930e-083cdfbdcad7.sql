-- Create places table to store saved locations
CREATE TABLE public.places (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('restaurant', 'cafe', 'bar', 'attraction', 'activity')),
  cuisine TEXT,
  address TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  source_url TEXT,
  coordinates_lat DECIMAL(10, 8),
  coordinates_lng DECIMAL(11, 8),
  is_visited BOOLEAN NOT NULL DEFAULT false,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

-- For now, allow public access (no auth required for MVP)
CREATE POLICY "Allow public read access" ON public.places FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.places FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.places FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.places FOR DELETE USING (true);

-- Insert sample places
INSERT INTO public.places (name, type, cuisine, address, description, coordinates_lat, coordinates_lng, is_visited, is_favorite) VALUES
('Adda', 'restaurant', 'Indian Food', '107 1st Ave, New York, NY 10003', 'Authentic Indian cuisine in a cozy setting. Known for their traditional dishes and warm atmosphere.', 40.7267, -73.9877, false, true),
('Joe''s Pizza', 'restaurant', 'Pizza', '7 Carmine St, New York, NY 10014', 'Iconic NYC pizza spot serving classic New York slices since 1975.', 40.7304, -74.0021, true, true),
('The High Line', 'attraction', NULL, 'New York, NY 10011', 'Elevated linear park built on a historic freight rail line.', 40.7480, -74.0048, false, false),
('Devoción', 'cafe', 'Coffee', '69 Grand St, Brooklyn, NY 11249', 'Colombian specialty coffee roaster with a beautiful greenhouse-like space.', 40.7143, -73.9617, false, true),
('Please Don''t Tell', 'bar', 'Speakeasy', '113 St Marks Pl, New York, NY 10009', 'Famous speakeasy hidden behind a phone booth inside a hot dog shop.', 40.7275, -73.9841, true, true),
('Brooklyn Bridge', 'attraction', NULL, 'Brooklyn Bridge, New York, NY', 'Iconic suspension bridge connecting Manhattan and Brooklyn.', 40.7061, -73.9969, true, false);
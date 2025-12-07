// Run this once to migrate existing places from JSON to Supabase
// Usage: npx tsx src/scripts/migrateToSupabase.ts

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://kzxmplnrozabftmmuchx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eG1wbG5yb3phYmZ0bW11Y2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjQ5NTIsImV4cCI6MjA4MDcwMDk1Mn0.ZvX-wGttZr5kWNP_Svxqfvl7Vyd2_L6MW8-Wy7j_ANg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migratePlaces() {
    const dataDir = path.join(__dirname, '../../server/data');

    // Migrate places for each user
    const userFiles = ['places_naveen1.json', 'places_karen1.json', 'places_test1.json'];

    for (const file of userFiles) {
        const userId = file.replace('places_', '').replace('.json', '');
        const filePath = path.join(dataDir, file);

        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${file} - file not found`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const places = data.places || [];

        if (places.length === 0) {
            console.log(`User ${userId}: No places to migrate`);
            continue;
        }

        console.log(`Migrating ${places.length} places for user ${userId}...`);

        for (const place of places) {
            const dbPlace = {
                id: place.id,
                user_id: userId,
                name: place.name,
                type: place.type || 'restaurant',
                cuisine: place.cuisine || null,
                address: place.address || '',
                description: place.description || null,
                image_url: place.imageUrl || null,
                source_url: place.sourceUrl || null,
                coordinates: place.coordinates || null,
                is_visited: place.isVisited || false,
                is_favorite: place.isFavorite !== false,
                notes: place.notes || null,
                review: place.review || null,
                rating: place.rating || null,
                start_date: place.startDate || null,
                end_date: place.endDate || null,
                is_event: place.isEvent || false,
                created_at: place.createdAt || new Date().toISOString(),
            };

            const { error } = await supabase
                .from('places')
                .upsert(dbPlace, { onConflict: 'id' });

            if (error) {
                console.error(`Error migrating place ${place.name}:`, error.message);
            }
        }

        console.log(`✅ User ${userId}: Migrated ${places.length} places`);
    }

    console.log('\n✅ Migration complete!');
}

migratePlaces().catch(console.error);

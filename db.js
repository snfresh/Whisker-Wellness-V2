const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database path
const dbPath = path.join(__dirname, 'whiskerwellness.db');

// Create database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
 
    console.log('Connected to SQLite database.');
  }
});

// Create tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Cats table
  db.run(`
    CREATE TABLE IF NOT EXISTS cats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      breed TEXT,
      age INTEGER,
      starting_weight REAL,
      target_weight REAL,
      image_url TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // WeightLogs table
  db.run(`
    CREATE TABLE IF NOT EXISTS weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cat_id INTEGER NOT NULL,
      date DATE NOT NULL,
      weight REAL NOT NULL,
      FOREIGN KEY (cat_id) REFERENCES cats (id)
    )
  `);

  // Breeds table
  db.run(`
    CREATE TABLE IF NOT EXISTS breeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      min_weight REAL,
      max_weight REAL,
      activity_level TEXT,
      grooming_needs TEXT,
      common_health_concerns TEXT,
      notes TEXT
    )
  `);

  // Food products table
  db.run(`
    CREATE TABLE IF NOT EXISTS food_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      category TEXT,
      age_group TEXT,
      breed_suitability TEXT,
      protein REAL,
      fat REAL,
      calories INTEGER,
      serving_size TEXT,
      is_top_brand INTEGER DEFAULT 0,
      placeholder_url TEXT
    )
  `);

  // Product items table
  db.run(`
    CREATE TABLE IF NOT EXISTS product_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      price TEXT,
      size TEXT,
      reviews TEXT,
      placeholder_url TEXT,
      image_url TEXT,
      min_weight REAL,
      max_weight REAL,
      age_group TEXT
    )
  `);

  // Add image_url column if it doesn't exist
  db.run(`ALTER TABLE product_items ADD COLUMN image_url TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding image_url column:', err.message);
    }
  });

  // Owned items table
  db.run(`
    CREATE TABLE IF NOT EXISTS owned_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      cat_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      item_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (cat_id) REFERENCES cats (id)
    )
  `);

  const breedData = [
    {
      name: 'Maine Coon',
      min_weight: 10,
      max_weight: 25,
      activity_level: 'high',
      grooming_needs: 'Weekly brushing, occasional baths',
      common_health_concerns: 'Hip dysplasia, hypertrophic cardiomyopathy, dental care',
      notes: 'Large, friendly cat that enjoys play and climbing.'
    },
    {
      name: 'Siamese',
      min_weight: 6,
      max_weight: 12,
      activity_level: 'high',
      grooming_needs: 'Low grooming needs, regular dental checks',
      common_health_concerns: 'Respiratory issues, dental disease',
      notes: 'Vocal and active; needs interaction and mental stimulation.'
    },
    {
      name: 'Domestic Short Hair',
      min_weight: 8,
      max_weight: 15,
      activity_level: 'moderate',
      grooming_needs: 'Easy care, regular brushing for shedding',
      common_health_concerns: 'Obesity, dental health',
      notes: 'Common, adaptable breed with balanced activity needs.'
    },
    {
      name: 'Persian',
      min_weight: 7,
      max_weight: 12,
      activity_level: 'low',
      grooming_needs: 'Daily brushing, eye cleaning',
      common_health_concerns: 'Respiratory issues, tooth decay',
      notes: 'Needs slow, gentle exercise and consistent grooming.'
    },
    {
      name: 'Bengal',
      min_weight: 8,
      max_weight: 15,
      activity_level: 'high',
      grooming_needs: 'Low grooming, high play needs',
      common_health_concerns: 'Joint health, skin sensitivity',
      notes: 'Very active breed that benefits from interactive toys.'
    },
    {
      name: 'Ragdoll',
      min_weight: 10,
      max_weight: 20,
      activity_level: 'moderate',
      grooming_needs: 'Weekly brushing, attention to coat and skin',
      common_health_concerns: 'Urinary tract issues, heart health',
      notes: 'Gentle and social; enjoys interactive exercise.'
    }
  ];

  breedData.forEach((breed) => {
    db.run(
      `INSERT OR IGNORE INTO breeds (name, min_weight, max_weight, activity_level, grooming_needs, common_health_concerns, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [breed.name, breed.min_weight, breed.max_weight, breed.activity_level, breed.grooming_needs, breed.common_health_concerns, breed.notes]
    );
  });

  const foodProducts = [
    {
      name: 'Adult Chicken & Rice',
      brand: 'Royal Canin',
      category: 'dry',
      age_group: 'adult',
      breed_suitability: 'all',
      protein: 32,
      fat: 14,
      calories: 400,
      serving_size: '1/2 cup',
      is_top_brand: 1,
      placeholder_url: 'https://example.com/royal-canin-adult'
    },
    {
      name: 'Indoor Weight Control',
      brand: 'Hill\'s Science Diet',
      category: 'dry',
      age_group: 'adult',
      breed_suitability: 'all',
      protein: 36,
      fat: 11,
      calories: 340,
      serving_size: '1/2 cup',
      is_top_brand: 1,
      placeholder_url: 'https://example.com/hills-weight-control'
    },
    {
      name: 'Kitten Chicken Pate',
      brand: 'Wellness',
      category: 'wet',
      age_group: 'kitten',
      breed_suitability: 'all',
      protein: 12,
      fat: 8,
      calories: 95,
      serving_size: '1 can',
      is_top_brand: 1,
      placeholder_url: 'https://example.com/wellness-kitten'
    },
    {
      name: 'Hairball Control',
      brand: 'Purina Pro Plan',
      category: 'dry',
      age_group: 'adult',
      breed_suitability: 'Persian,Domestic Short Hair',
      protein: 38,
      fat: 15,
      calories: 380,
      serving_size: '1/2 cup',
      is_top_brand: 1,
      placeholder_url: 'https://example.com/purina-hairball'
    },
    {
      name: 'Senior Health Formula',
      brand: 'Blue Buffalo',
      category: 'dry',
      age_group: 'senior',
      breed_suitability: 'all',
      protein: 30,
      fat: 12,
      calories: 360,
      serving_size: '1/2 cup',
      is_top_brand: 1,
      placeholder_url: 'https://example.com/blue-buffalo-senior'
    }
  ];

  foodProducts.forEach((product) => {
    db.run(
      `INSERT OR IGNORE INTO food_products (name, brand, category, age_group, breed_suitability, protein, fat, calories, serving_size, is_top_brand, placeholder_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [product.name, product.brand, product.category, product.age_group, product.breed_suitability, product.protein, product.fat, product.calories, product.serving_size, product.is_top_brand, product.placeholder_url]
    );
  });

  const productItems = [
    {
      name: 'Automatic Feeder',
      category: 'feeding',
      price: '$49.99',
      size: '2.5 lbs capacity',
      reviews: '4.5/5 by users',
      placeholder_url: 'https://example.com/auto-feeder',
      image_url: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=250&h=200&fit=crop&auto=format',
      min_weight: 0,
      max_weight: null,
      age_group: 'all'
    },
    {
      name: 'Slow Feed Bowl',
      category: 'feeding',
      price: '$19.99',
      size: 'Large',
      reviews: '4.3/5 by users',
      placeholder_url: 'https://example.com/slow-feed-bowl',
      image_url: 'https://images.unsplash.com/photo-1544568100-847a948585b9?w=250&h=200&fit=crop&auto=format',
      min_weight: 0,
      max_weight: null,
      age_group: 'all'
    },
    {
      name: 'Interactive Laser Toy',
      category: 'playing',
      price: '$24.99',
      size: 'Handheld',
      reviews: '4.6/5 by users',
      placeholder_url: 'https://example.com/laser-toy',
      image_url: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=250&h=200&fit=crop&auto=format',
      min_weight: 0,
      max_weight: null,
      age_group: 'all'
    },
    {
      name: 'Cat Tree with Perches',
      category: 'playing',
      price: '$89.99',
      size: '60 in tall',
      reviews: '4.4/5 by users',
      placeholder_url: 'https://example.com/cat-tree',
      image_url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=250&h=200&fit=crop&auto=format',
      min_weight: 0,
      max_weight: null,
      age_group: 'all'
    },
    {
      name: 'De-shedding Brush',
      category: 'grooming',
      price: '$14.99',
      size: 'Medium',
      reviews: '4.7/5 by users',
      placeholder_url: 'https://example.com/deshedder',
      image_url: 'https://images.unsplash.com/photo-1544568100-847a948585b9?w=250&h=200&fit=crop&auto=format',
      min_weight: 0,
      max_weight: null,
      age_group: 'all'
    },
    {
      name: 'Nail Clippers',
      category: 'grooming',
      price: '$9.99',
      size: 'Small',
      reviews: '4.2/5 by users',
      placeholder_url: 'https://example.com/nail-clippers',
      image_url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=250&h=200&fit=crop&auto=format',
      min_weight: 0,
      max_weight: null,
      age_group: 'all'
    }
  ];

  productItems.forEach((item) => {
    db.run(
      `INSERT OR IGNORE INTO product_items (name, category, price, size, reviews, placeholder_url, image_url, min_weight, max_weight, age_group)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.name, item.category, item.price, item.size, item.reviews, item.placeholder_url, item.image_url, item.min_weight, item.max_weight, item.age_group]
    );
    // Update image_url for existing records
    db.run(
      `UPDATE product_items SET image_url = ? WHERE name = ?`,
      [item.image_url, item.name]
    );
  });
});

module.exports = db;
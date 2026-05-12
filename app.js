const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'whiskerwellness_secret_key', // In production, use a secure key
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to check if user is logged in
function requireLogin(req, res, next) {
  if (req.session.userId) {
    return next();
  } else {
    res.redirect('/login');
  }
}

function getAgeGroup(age) {
  if (age === null || age === undefined || age === '') {
    return 'adult';
  }
  if (Number(age) < 1) {
    return 'kitten';
  }
  if (Number(age) >= 7) {
    return 'senior';
  }
  return 'adult';
}

function getActivityAdjustment(activityLevel) {
  if (!activityLevel) {
    return 1.0;
  }
  const value = activityLevel.toLowerCase();
  if (value === 'high') {
    return 1.15;
  }
  if (value === 'low') {
    return 0.95;
  }
  return 1.0;
}

function calculateDailyCalories(weightLbs, age, activityLevel) {
  const weightKg = Math.max(0.1, Number(weightLbs)) * 0.453592;
  const rer = 70 * Math.pow(weightKg, 0.75);
  let factor = 1.2;
  const ageGroup = getAgeGroup(age);
  if (ageGroup === 'kitten') {
    factor = 2.0;
  } else if (ageGroup === 'senior') {
    factor = 1.0;
  }
  return Math.round(rer * factor * getActivityAdjustment(activityLevel));
}

function normalizeBreedSuitability(text) {
  if (!text) {
    return 'all';
  }
  return text.toLowerCase();
}

// Routes

// Home page - redirect to login if not logged in, else show cats
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/cats');
  } else {
    res.redirect('/login');
  }
});

// Signup page
app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.render('signup', { error: 'Username already exists' });
        } else {
          res.render('signup', { error: 'Error creating account' });
        }
      } else {
        req.session.userId = this.lastID;
        res.redirect('/cats');
      }
    });
  } catch (err) {
    res.render('signup', { error: 'Error creating account' });
  }
});

// Login page
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) {
      res.render('login', { error: 'Invalid username or password' });
    } else {
      const match = await bcrypt.compare(password, user.password_hash);
      if (match) {
        req.session.userId = user.id;
        res.redirect('/cats');
      } else {
        res.render('login', { error: 'Invalid username or password' });
      }
    }
  });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Cats page - show user's cats
app.get('/cats', requireLogin, (req, res) => {
  db.all('SELECT * FROM cats WHERE user_id = ?', [req.session.userId], (err, cats) => {
    if (err) {
      res.send('Error loading cats');
    } else {
      res.render('cats', { cats });
    }
  });
});

// Add cat page
app.get('/cats/add', requireLogin, (req, res) => {
  db.all('SELECT name FROM breeds ORDER BY name', [], (err, breeds) => {
    if (err) {
      res.render('add_cat', { error: 'Error loading breed list', breeds: [] });
    } else {
      res.render('add_cat', { error: null, breeds });
    }
  });
});

app.post('/cats/add', requireLogin, upload.single('image_file'), (req, res) => {
  const { name, breed, age, starting_weight, target_weight, image_url } = req.body;
  let imagePath = image_url;
  if (req.file) {
    imagePath = '/uploads/' + req.file.filename;
  }
  db.run('INSERT INTO cats (user_id, name, breed, age, starting_weight, target_weight, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.session.userId, name, breed, age, starting_weight, target_weight, imagePath], function(err) {
      if (err) {
        db.all('SELECT name FROM breeds ORDER BY name', [], (err2, breeds) => {
          res.render('add_cat', { error: 'Error adding cat', breeds: err2 ? [] : breeds });
        });
      } else {
        res.redirect('/cats');
      }
    });
});

// Edit cat page
app.get('/cats/:id/edit', requireLogin, (req, res) => {
  const catId = req.params.id;
  db.get('SELECT * FROM cats WHERE id = ? AND user_id = ?', [catId, req.session.userId], (err, cat) => {
    if (err || !cat) {
      res.send('Cat not found');
    } else {
      db.all('SELECT name FROM breeds ORDER BY name', [], (err2, breeds) => {
        res.render('edit_cat', { cat, error: null, breeds: err2 ? [] : breeds });
      });
    }
  });
});

app.post('/cats/:id/edit', requireLogin, upload.single('image_file'), (req, res) => {
  const catId = req.params.id;
  const { name, breed, age, starting_weight, target_weight, image_url } = req.body;
  let imagePath = image_url;
  if (req.file) {
    imagePath = '/uploads/' + req.file.filename;
  }
  db.run('UPDATE cats SET name = ?, breed = ?, age = ?, starting_weight = ?, target_weight = ?, image_url = ? WHERE id = ? AND user_id = ?',
    [name, breed, age, starting_weight, target_weight, imagePath, catId, req.session.userId], function(err) {
      if (err) {
        res.render('edit_cat', { cat: { id: catId, name, breed, age, starting_weight, target_weight, image_url: imagePath }, error: 'Error updating cat', breeds: [] });
      } else {
        res.redirect('/cats');
      }
    });
});

// Delete cat
app.post('/cats/:id/delete', requireLogin, (req, res) => {
  const catId = req.params.id;
  db.run('DELETE FROM cats WHERE id = ? AND user_id = ?', [catId, req.session.userId], function(err) {
    if (err) {
      res.send('Error deleting cat');
    } else {
      // Also delete weight logs
      db.run('DELETE FROM weight_logs WHERE cat_id = ?', [catId]);
      res.redirect('/cats');
    }
  });
});

// Weight logs for a cat
app.get('/cats/:id/weights', requireLogin, (req, res) => {
  const catId = req.params.id;
  // Check if cat belongs to user
  db.get('SELECT * FROM cats WHERE id = ? AND user_id = ?', [catId, req.session.userId], (err, cat) => {
    if (err || !cat) {
      res.send('Cat not found');
    } else {
      db.all('SELECT * FROM weight_logs WHERE cat_id = ? ORDER BY date DESC', [catId], (err, logs) => {
        if (err) {
          res.send('Error loading weights');
        } else {
          res.render('weights', { cat, logs });
        }
      });
    }
  });
});

// Add weight
app.post('/cats/:id/weights', requireLogin, (req, res) => {
  const catId = req.params.id;
  const { date, weight } = req.body;
  db.run('INSERT INTO weight_logs (cat_id, date, weight) VALUES (?, ?, ?)', [catId, date, weight], (err) => {
    if (err) {
      res.send('Error adding weight');
    } else {
      res.redirect(`/cats/${catId}/weights`);
    }
  });
});

// Graph page
app.get('/cats/:id/graph', requireLogin, (req, res) => {
  const catId = req.params.id;
  db.get('SELECT * FROM cats WHERE id = ? AND user_id = ?', [catId, req.session.userId], (err, cat) => {
    if (err || !cat) {
      res.send('Cat not found');
    } else {
      // Get last 7 days of weights
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateStr = sevenDaysAgo.toISOString().split('T')[0];
      db.all('SELECT date, weight FROM weight_logs WHERE cat_id = ? AND date >= ? ORDER BY date', [catId, dateStr], (err, logs) => {
        if (err) {
          res.send('Error loading graph data');
        } else {
          res.render('graph', { cat, logs });
        }
      });
    }
  });
});

app.get('/breeds', requireLogin, (req, res) => {
  const searchTerm = req.query.q ? `%${req.query.q}%` : '%';
  db.all('SELECT * FROM breeds WHERE name LIKE ? ORDER BY name', [searchTerm], (err, breeds) => {
    if (err) {
      res.send('Error loading breed catalog');
    } else {
      res.render('breeds', { breeds, query: req.query.q || '' });
    }
  });
});

app.get('/cats/:id/feeding', requireLogin, (req, res) => {
  const catId = req.params.id;
  db.get('SELECT * FROM cats WHERE id = ? AND user_id = ?', [catId, req.session.userId], (err, cat) => {
    if (err || !cat) {
      res.send('Cat not found');
      return;
    }

    const ageGroup = getAgeGroup(cat.age);

    db.get('SELECT * FROM breeds WHERE name = ?', [cat.breed], (err2, breed) => {
      const dailyCalories = calculateDailyCalories(cat.starting_weight, cat.age, breed ? breed.activity_level : 'moderate');

      db.all('SELECT * FROM food_products WHERE age_group IN (?, "all") ORDER BY is_top_brand DESC, brand', [ageGroup], (err3, foods) => {
        if (err3) {
          res.send('Error loading food recommendations');
          return;
        }

        const recommendedFoods = foods.filter((product) => {
          const suitability = normalizeBreedSuitability(product.breed_suitability);
          return suitability === 'all' || (breed && suitability.includes(breed.name.toLowerCase()));
        }).slice(0, 5).map((product) => ({
          ...product,
          recommended_servings: product.calories > 0 ? Math.max(1, Math.round(dailyCalories / product.calories)) : null
        }));

        res.render('feeding', {
          cat,
          breed,
          ageGroup,
          calories: dailyCalories,
          recommendedFoods
        });
      });
    });
  });
});

app.get('/cats/:id/products', requireLogin, (req, res) => {
  const catId = req.params.id;
  db.get('SELECT * FROM cats WHERE id = ? AND user_id = ?', [catId, req.session.userId], (err, cat) => {
    if (err || !cat) {
      res.send('Cat not found');
      return;
    }

    const ageGroup = getAgeGroup(cat.age);
    const weight = Number(cat.starting_weight) || 0;

    db.all('SELECT * FROM product_items ORDER BY category, name', [], (err2, items) => {
      if (err2) {
        res.send('Error loading product items');
        return;
      }

      const fitsItem = (item) => {
        const withinWeight = (!item.min_weight || weight >= item.min_weight) && (!item.max_weight || weight <= item.max_weight);
        const withinAge = !item.age_group || item.age_group === 'all' || item.age_group === ageGroup;
        return withinWeight && withinAge;
      };

      const categories = {
        feeding: [],
        playing: [],
        grooming: []
      };

      items.filter(fitsItem).forEach((item) => {
        if (categories[item.category]) {
          categories[item.category].push(item);
        }
      });

      res.render('products', { cat, categories });
    });
  });
});

app.get('/cats/:id/activities', requireLogin, (req, res) => {
  const catId = req.params.id;
  const availableToys = ['Laser pointer', 'Feather wand', 'Toy mouse', 'Interactive ball', 'Cat teaser', 'Catnip toy'];

  db.get('SELECT * FROM cats WHERE id = ? AND user_id = ?', [catId, req.session.userId], (err, cat) => {
    if (err || !cat) {
      res.send('Cat not found');
      return;
    }

    db.get('SELECT * FROM breeds WHERE name = ?', [cat.breed], (err2, breed) => {
      db.all('SELECT item_name FROM owned_items WHERE user_id = ? AND cat_id = ?', [req.session.userId, catId], (err3, ownedRows) => {
        if (err3) {
          res.send('Error loading ownership data');
          return;
        }

        const ownedItems = ownedRows.map((row) => row.item_name);
        const ageGroup = getAgeGroup(cat.age);
        const suggestions = [];

        if (ageGroup === 'kitten') {
          suggestions.push('Use soft toys for short chase sessions to build confidence and stamina.');
        } else if (ageGroup === 'senior') {
          suggestions.push('Choose gentle play and slow-moving toys to keep your cat active without overexerting them.');
        } else {
          suggestions.push('Offer regular active play throughout the day to keep your cat at a healthy weight.');
        }

        if (breed) {
          if (breed.activity_level === 'high') {
            suggestions.push('High-energy breeds benefit from interactive chase and climbing games.');
          } else if (breed.activity_level === 'low') {
            suggestions.push('Low-energy breeds do better with slower, frequent play sessions.');
          } else {
            suggestions.push('Moderate activity breeds respond well to a mix of chasing and puzzle play.');
          }
        }

        ownedItems.forEach((item) => {
          if (item.toLowerCase().includes('laser')) {
            suggestions.push('Use the laser pointer for chase play to encourage fast movement.');
          }
          if (item.toLowerCase().includes('feather')) {
            suggestions.push('Wave the feather wand in gentle arcs to prompt jumping and pouncing.');
          }
          if (item.toLowerCase().includes('mouse')) {
            suggestions.push('Hide the toy mouse and encourage your cat to stalk and pounce.');
          }
          if (item.toLowerCase().includes('ball')) {
            suggestions.push('Roll the interactive ball across the floor for a playful chase session.');
          }
          if (item.toLowerCase().includes('teaser')) {
            suggestions.push('Use the teaser to build short active play routines multiple times each day.');
          }
          if (item.toLowerCase().includes('nip')) {
            suggestions.push('Add catnip to toys for extra interest during short activity bursts.');
          }
        });

        const suggestionsList = [...new Set(suggestions)];
        if (suggestionsList.length === 0) {
          suggestionsList.push('Try using fun toys and short sessions to keep your cat moving every day.');
        }

        res.render('activities', { cat, breed, availableToys, ownedItems, suggestions: suggestionsList });
      });
    });
  });
});

app.post('/cats/:id/activities', requireLogin, (req, res) => {
  const catId = req.params.id;
  const selectedToys = req.body.toys || [];
  const customToy = req.body.custom_toy ? req.body.custom_toy.trim() : '';
  const toys = Array.isArray(selectedToys) ? selectedToys : [selectedToys];
  if (customToy) {
    toys.push(customToy);
  }

  db.run('DELETE FROM owned_items WHERE user_id = ? AND cat_id = ?', [req.session.userId, catId], (err) => {
    if (err) {
      res.send('Error saving owned toys');
      return;
    }

    const insertToy = db.prepare('INSERT INTO owned_items (user_id, cat_id, item_name, item_type) VALUES (?, ?, ?, ?)');
    toys.filter((toy) => toy && toy.trim()).forEach((toy) => {
      insertToy.run(req.session.userId, catId, toy.trim(), 'toy');
    });
    insertToy.finalize(() => {
      res.redirect(`/cats/${catId}/activities`);
    });
  });
});

app.get('/cats/:id/breed-info', requireLogin, (req, res) => {
  const catId = req.params.id;
  db.get('SELECT * FROM cats WHERE id = ? AND user_id = ?', [catId, req.session.userId], (err, cat) => {
    if (err || !cat) {
      res.send('Cat not found');
      return;
    }

    db.get('SELECT * FROM breeds WHERE name = ?', [cat.breed], (err2, breed) => {
      if (err2) {
        res.send('Error loading breed info');
        return;
      }

      const recommendedWeight = breed ? `${breed.min_weight} - ${breed.max_weight} lbs` : 'Not available for this breed';
      const averageWeight = breed ? ((breed.min_weight + breed.max_weight) / 2).toFixed(1) : null;
      let comparison = 'No breed comparison available.';
      if (breed && cat.starting_weight) {
        if (cat.starting_weight < breed.min_weight) {
          comparison = 'This cat is under the recommended range.';
        } else if (cat.starting_weight > breed.max_weight) {
          comparison = 'This cat is above the recommended range.';
        } else {
          comparison = 'This cat is within the recommended range.';
        }
      }

      res.render('breed_info', {
        cat,
        breed,
        recommendedWeight,
        averageWeight,
        comparison
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
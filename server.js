
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const Database = require('better-sqlite3'); // Import SQLite
const axios = require('axios'); // For making API requests

// Connect to the SQLite database (or create it if it doesn't exist)
const db = new Database('bookTracker.db', { verbose: console.log }); // Add verbose logging

// Create tables if they don't exist
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS userBooks (
      userId TEXT PRIMARY KEY,
      count INTEGER,
      books TEXT
    );

    CREATE TABLE IF NOT EXISTS userGoals (
      userId TEXT PRIMARY KEY,
      goal INTEGER
    );

    CREATE TABLE IF NOT EXISTS readingChallenges (
      userId TEXT PRIMARY KEY,
      goal INTEGER,
      progress INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS readingStreaks (
      userId TEXT PRIMARY KEY,
      lastLogDate TEXT
    );
    
    CREATE TABLE IF NOT EXISTS userStreaks (
      userId TEXT PRIMARY KEY,
      currentStreak INTEGER DEFAULT 0,
      highestStreak INTEGER DEFAULT 0,
      lastLogDate TEXT
    );

    CREATE TABLE IF NOT EXISTS bookClubs (
      clubId TEXT PRIMARY KEY,
      name TEXT,
      ownerId TEXT
    );

    CREATE TABLE IF NOT EXISTS achievements (
      userId TEXT PRIMARY KEY,
      bookworm INTEGER DEFAULT 0,
      marathonReader INTEGER DEFAULT 0,
      genreExplorer INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS userPoints (
      userId TEXT PRIMARY KEY,
      points INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS serverPrefixes (
      serverId TEXT PRIMARY KEY,
      prefix TEXT
    );

    CREATE TABLE IF NOT EXISTS commandMappings (
      serverId TEXT,
      customCommand TEXT,
      originalCommand TEXT,
      PRIMARY KEY (serverId, customCommand)
    );

    CREATE TABLE IF NOT EXISTS queerBooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      author TEXT,
      description TEXT,
      genre TEXT,
      coverUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS userProfiles (
      userId TEXT PRIMARY KEY,
      favoriteBooks TEXT, -- JSON array of favorite books
      bio TEXT, -- Optional: User bio
      profileColor TEXT -- Optional: Custom profile color
    );
  `);
  console.log('Database and tables created successfully!');
} catch (error) {
  console.error('Error creating database or tables:', error);
}

// Helper functions for database operations
const database = {
  // Save user books
  saveUserBooks: (userId, count, books) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO userBooks (userId, count, books) VALUES (?, ?, ?)');
    stmt.run(userId, count, JSON.stringify(books));
  },

  // Load user books
  loadUserBooks: (userId) => {
    const stmt = db.prepare('SELECT count, books FROM userBooks WHERE userId = ?');
    const row = stmt.get(userId);
    if (row) {
      return {
        count: row.count,
        books: JSON.parse(row.books),
      };
    }
    return null;
  },

  // Save user goals
  saveUserGoal: (userId, goal) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO userGoals (userId, goal) VALUES (?, ?)');
    stmt.run(userId, goal);
  },

  // Load user goals
  loadUserGoal: (userId) => {
    const stmt = db.prepare('SELECT goal FROM userGoals WHERE userId = ?');
    const row = stmt.get(userId);
    return row ? row.goal : null;
  },

  // Save reading challenge
  saveReadingChallenge: (userId, goal) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO readingChallenges (userId, goal) VALUES (?, ?)');
    stmt.run(userId, goal);
  },

  // Load reading challenge
  loadReadingChallenge: (userId) => {
    const stmt = db.prepare('SELECT goal, progress FROM readingChallenges WHERE userId = ?');
    const row = stmt.get(userId);
    return row ? row : null;
  },

  // Save reading streak
  saveReadingStreak: (userId, lastLogDate) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO readingStreaks (userId, lastLogDate) VALUES (?, ?)');
    stmt.run(userId, lastLogDate);
  },

  // Load reading streak (legacy method)
  loadReadingStreak: (userId) => {
    const stmt = db.prepare('SELECT lastLogDate FROM readingStreaks WHERE userId = ?');
    const row = stmt.get(userId);
    return row ? row.lastLogDate : null;
  },
  
  // Save user streak (new implementation)
  saveUserStreak: (userId, currentStreak, highestStreak, lastLogDate) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO userStreaks (userId, currentStreak, highestStreak, lastLogDate) VALUES (?, ?, ?, ?)');
    stmt.run(userId, currentStreak, highestStreak, lastLogDate);
  },
  
  // Load user streak (new implementation)
  loadUserStreak: (userId) => {
    const stmt = db.prepare('SELECT currentStreak, highestStreak, lastLogDate FROM userStreaks WHERE userId = ?');
    const row = stmt.get(userId);
    return row ? row : null;
  },

  // Save book club
  saveBookClub: (clubId, name, ownerId) => {
    const stmt = db.prepare('INSERT INTO bookClubs (clubId, name, ownerId) VALUES (?, ?, ?)');
    stmt.run(clubId, name, ownerId);
  },

  // Load book club
  loadBookClub: (clubId) => {
    const stmt = db.prepare('SELECT * FROM bookClubs WHERE clubId = ?');
    const row = stmt.get(clubId);
    return row ? row : null;
  },

  // Save achievements
  saveAchievements: (userId, achievements) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO achievements (userId, bookworm, marathonReader, genreExplorer) VALUES (?, ?, ?, ?)');
    stmt.run(userId, achievements.bookworm, achievements.marathonReader, achievements.genreExplorer);
  },

  // Load achievements
  loadAchievements: (userId) => {
    const stmt = db.prepare('SELECT * FROM achievements WHERE userId = ?');
    const row = stmt.get(userId);
    return row ? row : null;
  },

  // Save user points
  saveUserPoints: (userId, points) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO userPoints (userId, points) VALUES (?, ?)');
    stmt.run(userId, points);
  },

  // Load user points
  loadUserPoints: (userId) => {
    const stmt = db.prepare('SELECT points FROM userPoints WHERE userId = ?');
    const row = stmt.get(userId);
    return row ? row.points : null;
  },

  // Save server prefix
  saveServerPrefix: (serverId, prefix) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO serverPrefixes (serverId, prefix) VALUES (?, ?)');
    stmt.run(serverId, prefix);
  },

  // Load server prefix
  loadServerPrefix: (serverId) => {
    const stmt = db.prepare('SELECT prefix FROM serverPrefixes WHERE serverId = ?');
    const row = stmt.get(serverId);
    return row ? row.prefix : null;
  },

  // Load command mapping
  loadCommandMapping: (serverId, customCommand) => {
    const stmt = db.prepare('SELECT originalCommand FROM commandMappings WHERE serverId = ? AND customCommand = ?');
    const row = stmt.get(serverId, customCommand);
    return row ? row.originalCommand : null;
  },

  // Save queer book
  saveQueerBook: (title, author, description, genre, coverUrl) => {
    const stmt = db.prepare('INSERT INTO queerBooks (title, author, description, genre, coverUrl) VALUES (?, ?, ?, ?, ?)');
    stmt.run(title, author, description, genre, coverUrl);
  },

  // Load queer books
  loadQueerBooks: () => {
    const stmt = db.prepare('SELECT title, author, description, genre, coverUrl FROM queerBooks');
    const rows = stmt.all();
    return rows;
  },

  // Save user profile
  saveUserProfile: (userId, favoriteBooks, bio, profileColor) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO userProfiles (userId, favoriteBooks, bio, profileColor) VALUES (?, ?, ?, ?)');
    stmt.run(userId, JSON.stringify(favoriteBooks), bio, profileColor);
  },

  // Load user profile
  loadUserProfile: (userId) => {
    const stmt = db.prepare('SELECT favoriteBooks, bio, profileColor FROM userProfiles WHERE userId = ?');
    const row = stmt.get(userId);
    if (row) {
      return {
        favoriteBooks: JSON.parse(row.favoriteBooks),
        bio: row.bio,
        profileColor: row.profileColor,
      };
    }
    return null;
  },
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Fetch book data from Open Library API
async function fetchBookData(query) {
  try {
    const response = await axios.get(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}`);

    if (!response.data.docs || response.data.docs.length === 0) {
      console.log('No books found for query:', query);
      return null;
    }

    const book = response.data.docs[0];
    console.log('Book data received:', JSON.stringify(book, null, 2).substring(0, 500) + '...');

    const coverId = book.cover_i;
    const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : 'https://via.placeholder.com/150'; // Fallback to a placeholder image

    // Check multiple fields for genre information
    let genre = 'Unknown Genre';
    if (book.subject && book.subject.length > 0) {
      genre = book.subject.slice(0, 3).join(', ');
    } else if (book.subject_key && book.subject_key.length > 0) {
      genre = book.subject_key.slice(0, 3).join(', ');
    } else if (book.subject_facet && book.subject_facet.length > 0) {
      genre = book.subject_facet.slice(0, 3).join(', ');
    }

    return {
      title: book.title,
      author: book.author_name ? book.author_name.join(', ') : 'Unknown Author',
      description: book.first_sentence ? book.first_sentence.join(' ') : 'No description available.',
      genre: genre,
      coverUrl: coverUrl,
    };
  } catch (error) {
    console.error('Error fetching book data:', error);
    return null;
  }
}

// Fun facts about books
const funFacts = [
  "The longest sentence ever printed is in Victor Hugo's 'Les Misérables' and contains 823 words.",
  "J.K. Rowling was rejected by 12 publishers before 'Harry Potter' was accepted.",
  "The smallest book in the world is 'Teeny Ted from Turnip Town' and measures 0.07 mm x 0.10 mm.",
  "The first book ever written on a typewriter is 'The Adventures of Tom Sawyer' by Mark Twain.",
  "The most expensive book ever sold is Leonardo da Vinci's 'Codex Leicester,' which sold for $30.8 million.",
];

// Famous book quotes
const bookQuotes = [
  { quote: "So we beat on, boats against the current, borne back ceaselessly into the past.", book: "The Great Gatsby by F. Scott Fitzgerald" },
  { quote: "All we have to decide is what to do with the time that is given us.", book: "The Lord of the Rings by J.R.R. Tolkien" },
  { quote: "It is our choices, Harry, that show what we truly are, far more than our abilities.", book: "Harry Potter and the Chamber of Secrets by J.K. Rowling" },
  { quote: "The only way out of the labyrinth of suffering is to forgive.", book: "Looking for Alaska by John Green" },
  { quote: "We accept the love we think we deserve.", book: "The Perks of Being a Wallflower by Stephen Chbosky" },
];

// Mood-based book recommendations
const moodBooks = {
  happy: [
    { title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams", coverUrl: "https://covers.openlibrary.org/b/id/8400381-L.jpg" },
    { title: "Bridget Jones's Diary", author: "Helen Fielding", coverUrl: "https://covers.openlibrary.org/b/id/8400381-L.jpg" },
  ],
  sad: [
    { title: "The Book Thief", author: "Markus Zusak", coverUrl: "https://covers.openlibrary.org/b/id/8400381-L.jpg" },
    { title: "A Little Life", author: "Hanya Yanagihara", coverUrl: "https://covers.openlibrary.org/b/id/8400381-L.jpg" },
  ],
  adventurous: [
    { title: "The Hobbit", author: "J.R.R. Tolkien", coverUrl: "https://covers.openlibrary.org/b/id/8400381-L.jpg" },
    { title: "The Hunger Games", author: "Suzanne Collins", coverUrl: "https://covers.openlibrary.org/b/id/8400381-L.jpg" },
  ],
};

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('addbook')
    .setDescription('Add a book to your list')
    .addStringOption(option => 
      option.setName('title')
        .setDescription('The name of the book')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('bookcount')
    .setDescription('Check how many books you\'ve read'),
  
  new SlashCommandBuilder()
    .setName('recommend')
    .setDescription('Get a book recommendation'),
  
  new SlashCommandBuilder()
    .setName('recommendqueer')
    .setDescription('Add a queer book to the recommendation list')
    .addStringOption(option => 
      option.setName('title')
        .setDescription('The title or author of the book')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('listbooks')
    .setDescription('List all books you\'ve read'),
  
  new SlashCommandBuilder()
    .setName('removebook')
    .setDescription('Remove a book from your list')
    .addStringOption(option => 
      option.setName('title')
        .setDescription('The name of the book')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('setgoal')
    .setDescription('Set a reading goal')
    .addIntegerOption(option => 
      option.setName('goal')
        .setDescription('Number of books to read')
        .setRequired(true)
        .setMinValue(1)),
  
  new SlashCommandBuilder()
    .setName('progress')
    .setDescription('Check your progress toward your goal'),
  
  new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('Start a reading challenge')
    .addIntegerOption(option => 
      option.setName('goal')
        .setDescription('Number of books for the challenge')
        .setRequired(true)
        .setMinValue(1)),
  
  new SlashCommandBuilder()
    .setName('streak')
    .setDescription('Check your reading streak'),
  
  new SlashCommandBuilder()
    .setName('streakadd')
    .setDescription('Log your daily reading to maintain your streak'),
  
  new SlashCommandBuilder()
    .setName('streakoverride')
    .setDescription('Admin only: Override a user\'s streak')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('The user to update')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('streak')
        .setDescription('New streak value')
        .setRequired(true)
        .setMinValue(0)),
  
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('See the top readers'),
  
  new SlashCommandBuilder()
    .setName('bookclub')
    .setDescription('Book club commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a book club')
        .addStringOption(option => 
          option.setName('name')
            .setDescription('Name of the book club')
            .setRequired(true))),
  
  new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View your achievements'),
  
  new SlashCommandBuilder()
    .setName('points')
    .setDescription('Check your points'),
  
  new SlashCommandBuilder()
    .setName('funfact')
    .setDescription('Get a fun fact about books'),
  
  new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Get a quote from a famous book'),
  
  new SlashCommandBuilder()
    .setName('mood')
    .setDescription('Get a book recommendation based on your mood')
    .addStringOption(option => 
      option.setName('mood')
        .setDescription('Your current mood')
        .setRequired(true)
        .addChoices(
          { name: 'Happy', value: 'happy' },
          { name: 'Sad', value: 'sad' },
          { name: 'Adventurous', value: 'adventurous' }
        )),
  
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your reading profile'),
  
  new SlashCommandBuilder()
    .setName('setbio')
    .setDescription('Set your profile bio')
    .addStringOption(option => 
      option.setName('bio')
        .setDescription('Your profile bio')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('setcolor')
    .setDescription('Set your profile color')
    .addStringOption(option => 
      option.setName('color')
        .setDescription('Hex color code (e.g., #800080)')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('favorite')
    .setDescription('Add or remove a book from your favorites')
    .addStringOption(option => 
      option.setName('title')
        .setDescription('The title of the book')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display help message'),
];

// Bot login
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  try {
    console.log('Started refreshing application (/) commands.');
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error refreshing commands:', error);
  }
});

// Handle interaction events
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  
  try {
    const { commandName, options } = interaction;
    const userId = interaction.user.id;
    
    // Add a book
    if (commandName === 'addbook') {
      await interaction.deferReply(); // For potentially slow operations
      
      const bookName = options.getString('title');
      if (!bookName) {
        return interaction.editReply('Please provide a book name!');
      }

      let userData = database.loadUserBooks(userId);
      if (!userData) {
        userData = { count: 0, books: [] };
      }

      // Fetch book data from Open Library API
      const bookData = await fetchBookData(bookName);
      if (!bookData) {
        return interaction.editReply('Could not find the book. Please try again with a different title or author.');
      }

      // Add the book to the user's list
      userData.count += 1;
      userData.books.push(bookData.title);
      database.saveUserBooks(userId, userData.count, userData.books); // Save to database

      // Update reading streak
      const today = new Date().toISOString().split('T')[0];
      database.saveReadingStreak(userId, today);

      // Create an embed with the book cover
      const embed = new EmbedBuilder()
        .setColor('#800080') // Purple color
        .setTitle('Book Added')
        .setDescription(`Added "${bookData.title}" to your list!`)
        .addFields({ name: 'Author', value: bookData.author, inline: true })
        .addFields({ name: 'Genre', value: bookData.genre, inline: true })
        .setThumbnail(bookData.coverUrl) // Book cover
        .setFooter({ text: 'Happy reading! 📚' });

      interaction.editReply({ embeds: [embed] });
    }

    // Show book count
    else if (commandName === 'bookcount') {
      const userData = database.loadUserBooks(userId);

      if (!userData || userData.count === 0) {
        return interaction.reply("You haven't added any books yet!");
      }

      const embed = new EmbedBuilder()
        .setColor('#800080') // Purple color
        .setTitle('Your Reading Progress')
        .setDescription(`You've read **${userData.count}** books so far!`)
        .setFooter({ text: 'Keep up the great work! 📖' });

      interaction.reply({ embeds: [embed] });
    }

    // Show LGBTQ+ book recommendation
    else if (commandName === 'recommend') {
      const queerBooks = database.loadQueerBooks();
      if (queerBooks.length > 0) {
        const randomBook = queerBooks[Math.floor(Math.random() * queerBooks.length)];
        const embed = new EmbedBuilder()
          .setColor('#800080') // Purple color
          .setTitle('Queer Book Recommendation')
          .setDescription(`Here's a recommendation for you!`)
          .addFields({ name: 'Title', value: randomBook.title, inline: true })
          .addFields({ name: 'Author', value: randomBook.author, inline: true })
          .addFields({ name: 'Genre', value: randomBook.genre, inline: true })
          .addFields({ name: 'Description', value: randomBook.description })
          .setImage(randomBook.coverUrl) // Larger book cover
          .setFooter({ text: 'Enjoy your reading! 🌈' });

        interaction.reply({ embeds: [embed] });
      } else {
        interaction.reply("No queer books available for recommendation. Use `/recommendqueer` to add some!");
      }
    }

    // Recommend a queer book
    else if (commandName === 'recommendqueer') {
      await interaction.deferReply();
      
      const bookQuery = options.getString('title');
      if (!bookQuery) {
        return interaction.editReply('Please provide a book title or author!');
      }

      const bookData = await fetchBookData(bookQuery);
      if (bookData) {
        database.saveQueerBook(bookData.title, bookData.author, bookData.description, bookData.genre, bookData.coverUrl);
        const embed = new EmbedBuilder()
          .setColor('#800080') // Purple color
          .setTitle('Queer Book Added')
          .setDescription(`Added "${bookData.title}" by ${bookData.author} to the queer books list!`)
          .addFields({ name: 'Genre', value: bookData.genre, inline: true })
          .addFields({ name: 'Description', value: bookData.description })
          .setThumbnail(bookData.coverUrl) // Book cover
          .setFooter({ text: 'Thank you for contributing! 📚' });

        interaction.editReply({ embeds: [embed] });
      } else {
        interaction.editReply('Could not find the book. Please try again with a different title or author.');
      }
    }

    // List all books
    else if (commandName === 'listbooks') {
      const userData = database.loadUserBooks(userId);

      if (!userData || userData.books.length === 0) {
        return interaction.reply("You haven't added any books yet!");
      }

      const bookList = userData.books.map((book, index) => `${index + 1}. ${book}`).join('\n');
      const embed = new EmbedBuilder()
        .setColor('#800080') // Purple color
        .setTitle('Your Reading List')
        .setDescription(`Here are the books you've read:\n${bookList}`)
        .setFooter({ text: 'Keep reading! 📚' });

      interaction.reply({ embeds: [embed] });
    }

    // Remove a book
    else if (commandName === 'removebook') {
      const bookName = options.getString('title');
      if (!bookName) {
        return interaction.reply('Please provide a book name!');
      }

      const userData = database.loadUserBooks(userId);

      if (!userData || userData.books.length === 0) {
        return interaction.reply("You haven't added any books yet!");
      }

      const index = userData.books.indexOf(bookName);
      if (index === -1) {
        return interaction.reply(`"${bookName}" is not in your list!`);
      }

      userData.books.splice(index, 1);
      userData.count -= 1;
      database.saveUserBooks(userId, userData.count, userData.books); // Save to database

      const embed = new EmbedBuilder()
        .setColor('#800080') // Purple color
        .setTitle('Book Removed')
        .setDescription(`Removed "${bookName}" from your list!`)
        .addFields({ name: 'Total Books Read', value: userData.count.toString(), inline: true })
        .setFooter({ text: 'Keep up the great work! 📖' });

      interaction.reply({ embeds: [embed] });
    }

    // Set a reading goal
    else if (commandName === 'setgoal') {
      const goal = options.getInteger('goal');
      if (isNaN(goal) || goal <= 0) {
        return interaction.reply('Please provide a valid number for your reading goal!');
      }

      database.saveUserGoal(userId, goal);
      const embed = new EmbedBuilder()
        .setColor('#800080') // Purple color
        .setTitle('Reading Goal Set')
        .setDescription(`Your reading goal for this year is **${goal}** books!`)
        .setFooter({ text: 'You can do it! 📚' });

      interaction.reply({ embeds: [embed] });
    }

    // Check progress toward goal
    else if (commandName === 'progress') {
      const userData = database.loadUserBooks(userId);
      const goal = database.loadUserGoal(userId);

      if (!userData || userData.count === 0) {
        return interaction.reply("You haven't added any books yet!");
      }

      if (!goal) {
        return interaction.reply("You haven't set a reading goal yet! Use `/setgoal` to set one.");
      }

      const remaining = goal - userData.count;
      if (remaining <= 0) {
        const embed = new EmbedBuilder()
          .setColor('#800080') // Purple color
          .setTitle('Goal Achieved!')
          .setDescription(`Congratulations! You've reached your goal of **${goal}** books!`)
          .setFooter({ text: 'Keep up the great work! 🎉' });

        interaction.reply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#800080') // Purple color
          .setTitle('Progress Toward Goal')
          .setDescription(`You've read **${userData.count}** books. Only **${remaining}** more to reach your goal of **${goal}**!`)
          .setFooter({ text: 'You can do it! 📚' });

        interaction.reply({ embeds: [embed] });
      }
    }

    // Start a reading challenge
    else if (commandName === 'challenge') {
      const goal = options.getInteger('goal');
      if (isNaN(goal) || goal <= 0) {
        return interaction.reply('Please provide a valid number for your reading goal!');
      }

      database.saveReadingChallenge(userId, goal);
      const embed = new EmbedBuilder()
        .setColor('#800080') // Purple color
        .setTitle('Reading Challenge Started')
        .setDescription(`Challenge started! Read **${goal}** books to complete the challenge.`)
        .setFooter({ text: 'Good luck! 📖' });

      interaction.reply({ embeds: [embed] });
    }

    // Check reading streak
    else if (commandName === 'streak') {
      const streakData = database.loadUserStreak(userId);

      if (streakData) {
        const embed = new EmbedBuilder()
          .setColor('#800080') // Purple color
          .setTitle('Reading Streak')
          .setDescription(`Your current reading streak is **${streakData.currentStreak}** days!`)
          .addFields({ name: 'Highest Streak', value: `${streakData.highestStreak} days`, inline: true })
          .addFields({ name: 'Last Read', value: streakData.lastLogDate ? new Date(streakData.lastLogDate).toLocaleDateString() : 'Never', inline: true })
          .setFooter({ text: 'Keep it up! Use /streakadd to log your daily reading. 📚' });

        interaction.reply({ embeds: [embed] });
      } else {
        interaction.reply("You haven't started a reading streak yet. Use `/streakadd` to start your streak!");
      }
    }
    
    // Manually log reading for streak
    else if (commandName === 'streakadd') {
      const today = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
      
      // Get existing streak data or initialize new data
      let streakData = database.loadUserStreak(userId);
      
      if (!streakData) {
        streakData = {
          currentStreak: 0,
          highestStreak: 0,
          lastLogDate: null
        };
      }
      
      // Check if already logged today
      if (streakData.lastLogDate === today) {
        return interaction.reply("You've already logged your reading for today!");
      }
      
      // Check if streak is broken (more than 1 day since last log)
      const lastDate = streakData.lastLogDate ? new Date(streakData.lastLogDate) : null;
      const currentDate = new Date(today);
      
      if (lastDate) {
        // Clone the date and add one day to get "yesterday"
        const yesterday = new Date(lastDate);
        yesterday.setDate(yesterday.getDate() + 1);
        
        // Format as YYYY-MM-DD for comparison
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const todayStr = currentDate.toISOString().split('T')[0];
        
        if (yesterdayStr !== todayStr) {
          // Streak is broken - record the highest streak
          const embed = new EmbedBuilder()
            .setColor('#FF0000') // Red color for broken streak
            .setTitle('Streak Broken')
            .setDescription(`Your reading streak of **${streakData.currentStreak}** days was broken!`)
            .addFields({ name: 'Highest Streak', value: `${streakData.highestStreak} days` })
            .setFooter({ text: 'Start a new streak today! 📚' });
            
          streakData.currentStreak = 1; // Reset to 1 for today's log
          interaction.reply({ embeds: [embed] });
        } else {
          // Streak continues
          streakData.currentStreak += 1;
          
          // Update highest streak if current is higher
          if (streakData.currentStreak > streakData.highestStreak) {
            streakData.highestStreak = streakData.currentStreak;
          }
          
          const embed = new EmbedBuilder()
            .setColor('#800080') // Purple color
            .setTitle('Reading Streak Updated')
            .setDescription(`Your current reading streak is now **${streakData.currentStreak}** days!`)
            .setFooter({ text: 'Keep it up! 📚' });
            
          interaction.reply({ embeds: [embed] });
        }
      } else {
        // First time logging - start with 1
        streakData.currentStreak = 1;
        streakData.highestStreak = 1;
        
        const embed = new EmbedBuilder()
          .setColor('#800080') // Purple color
          .setTitle('Reading Streak Started')
          .setDescription(`You've started a reading streak! Current streak: **${streakData.currentStreak}** day.`)
          .setFooter({ text: 'Use /streakadd tomorrow to keep your streak going! 📚' });
          
        interaction.reply({ embeds: [embed] });
      }
      
      // Update the last log date to today
      streakData.lastLogDate = today;
      
      // Save updated streak data
      database.saveUserStreak(userId, streakData.currentStreak, streakData.highestStreak, streakData.lastLogDate);
      
      // Log this action using our debug utility
      const debug = require('./debug.js');
      debug.logMessage(`/streakadd`, userId, 'streakadd');
    }
    
    // Admin command to override streaks
    else if (commandName === 'streakoverride') {
      const botOwnerId = '1252732120711954596'; // Bot owner's Discord user ID
      
      // Check if command user is the bot owner
      if (userId !== botOwnerId) {
        return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
      }
      
      // Get mentioned user and streak value
      const mentionedUser = options.getUser('user');
      const newStreakValue = options.getInteger('streak');
      
      if (!mentionedUser || isNaN(newStreakValue) || newStreakValue < 0) {
        return interaction.reply({ content: "Please mention a user and provide a valid streak number.", ephemeral: true });
      }
      
      const targetUserId = mentionedUser.id;
      let streakData = database.loadUserStreak(targetUserId);
      
      if (!streakData) {
        streakData = {
          currentStreak: 0,
          highestStreak: 0,
          lastLogDate: null
        };
      }
      
      // Update the streak values
      streakData.currentStreak = newStreakValue;
      
      // Update highest streak if necessary
      if (newStreakValue > streakData.highestStreak) {
        streakData.highestStreak = newStreakValue;
      }
      
      // Set last log date to today
      streakData.lastLogDate = new Date().toISOString().split('T')[0];
      
      // Save the updated streak data
      database.saveUserStreak(targetUserId, streakData.currentStreak, streakData.highestStreak, streakData.lastLogDate);
      
      const embed = new EmbedBuilder()
        .setColor('#00FF00') // Green color
        .setTitle('Streak Override')
        .setDescription(`Successfully set ${mentionedUser.username}'s streak to **${newStreakValue}** days.`)
        .setFooter({ text: 'Admin command executed' });
        
      interaction.reply({ embeds: [embed] });
      
      // Log this admin action
      const debug = require('./debug.js');
      debug.logMessage(`ADMIN ACTION: Set ${mentionedUser.username}'s streak to ${newStreakValue}`, userId, 'streakoverride');
    }

    // Show leaderboard
    else if (commandName === 'leaderboard') {
      const stmt = db.prepare('SELECT userId, count FROM userBooks ORDER BY count DESC LIMIT 10');
      const rows = stmt.all();

      if (rows.length > 0) {
        const leaderboard = rows.map((row, index) => `${index + 1}. <@${row.userId}> - ${row.count} books`).join('\n');
        const embed = new EmbedBuilder()
          .setColor('#800080') // Purple color
          .setTitle('Top Readers')
          .setDescription(leaderboard)
          .setFooter({ text: 'Keep reading! 📚' });

        interaction.reply({ embeds: [embed] });
      } else {
        interaction.reply("No one has logged any books yet!");
      }
    }

    // Create a book club
    else if (commandName === 'bookclub') {
      const subcommand = options.getSubcommand();
      
      if (subcommand === 'create') {
        const clubName = options.getString('name');
        if (!clubName) {
          return interaction.reply('Please provide a name for the book club!');
        }

        const clubId = interaction.guild.id + '-' + clubName.toLowerCase().replace(/ /g, '-');

        database.saveBookClub(clubId, clubName, userId);
        const embed = new EmbedBuilder()
          .setColor('#800080') // Purple color
          .setTitle('Book Club Created')
          .setDescription(`Book club **${clubName}** created!`)
          .setFooter({ text: 'Happy reading! 📚' });

        interaction.reply({ embeds: [embed] });
      }
    }

    // Show achievements
    else if (commandName === 'achievements') {
      const achievements = database.loadAchievements(userId);

      if (achievements) {
        const unlockedAchievements = [];
        if (achievements.bookworm) unlockedAchievements.push('- Bookworm: Read 10 books');
        if (achievements.marathonReader) unlockedAchievements.push('- Marathon Reader: Read 50 books');
        if (achievements.genreExplorer) unlockedAchievements.push('- Genre Explorer: Read books from 5 different genres');

        if (unlockedAchievements.length > 0) {
          const embed = new EmbedBuilder()
            .setColor('#800080') // Purple color
            .setTitle('Your Achievements')
            .setDescription(unlockedAchievements.join('\n'))
            .setFooter({ text: 'Keep reading to unlock more! 📚' });

          interaction.reply({ embeds: [embed] });
        } else {
          interaction.reply("You haven't unlocked any achievements yet!");
        }
      } else {
        interaction.reply("You haven't unlocked any achievements yet!");
      }
    }

    // Show points
    else if (commandName === 'points') {
      const points = database.loadUserPoints(userId);

      if (points !== null) {
        const embed = new EmbedBuilder()
          .setColor('#800080') // Purple color
          .setTitle('Your Points')
          .setDescription(`You have **${points}** points!`)
          .setFooter({ text: 'Keep earning points! 📚' });

        interaction.reply({ embeds: [embed] });
      } else {
        interaction.reply("You haven't earned any points yet!");
      }
    }

    // Fun facts command
    else if (commandName === 'funfact') {
      const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];
      const embed = new EmbedBuilder()
        .setColor('#800080') // Purple color
        .setTitle('Did You Know?')
        .setDescription(randomFact)
        .setFooter({ text: 'Keep reading to learn more! 📚' });

      interaction.reply({ embeds: [embed] });
    }

    // Book quotes command
    else if (commandName === 'quote') {
      const randomQuote = bookQuotes[Math.floor(Math.random() * bookQuotes.length)];
      const embed = new EmbedBuilder()
        .setColor('#800080') // Purple color
        .setTitle('Book Quote')
        .setDescription(`"${randomQuote.quote}"\n\n— **${randomQuote.book}**`)
        .setFooter({ text: 'Keep reading for more inspiration! 📖' });

      interaction.reply({ embeds: [embed] });
    }

    // Mood-based recommendations
    else if (commandName === 'mood') {
      const mood = options.getString('mood');
      if (!mood || !moodBooks[mood]) {
        return interaction.reply('Please specify a valid mood: happy, sad, or adventurous.');
      }

      const randomBook = moodBooks[mood][Math.floor(Math.random() * moodBooks[mood].length)];
      const embed = new EmbedBuilder()
        .setColor('#800080') // Purple color
        .setTitle('Mood-Based Recommendation')
        .setDescription(`Here's a book for your **${mood}** mood!`)
        .addFields({ name: 'Title', value: randomBook.title, inline: true })
        .addFields({ name: 'Author', value: randomBook.author, inline: true })
        .setThumbnail(randomBook.coverUrl) // Book cover
        .setFooter({ text: 'Enjoy your reading! 📚' });

      interaction.reply({ embeds: [embed] });
    }

    // View profile command
    else if (commandName === 'profile') {
      const userData = database.loadUserBooks(userId);
      const profile = database.loadUserProfile(userId);
      const achievements = database.loadAchievements(userId);

      if (!userData || userData.count === 0) {
        return interaction.reply("You haven't added any books yet!");
      }

      // Calculate leaderboard position
      const leaderboardStmt = db.prepare('SELECT userId FROM userBooks ORDER BY count DESC');
      const leaderboard = leaderboardStmt.all();
      const leaderboardPosition = leaderboard.findIndex(row => row.userId === userId) + 1;

      // Get the user's avatar URL
      const avatarURL = interaction.user.displayAvatarURL({ dynamic: true, format: 'png', size: 256 });

      // Get streak information from the new system
      const streakData = database.loadUserStreak(userId);
      let streakDays = streakData ? streakData.currentStreak : 0;
      let highestStreakDays = streakData ? streakData.highestStreak : 0;

      // Build profile embed
      const embed = new EmbedBuilder()
        .setColor(profile?.profileColor || '#800080') // Use custom profile color or default
        .setTitle(`${interaction.user.username}'s Profile`)
        .setDescription(profile?.bio || 'No bio set.')
        .setThumbnail(avatarURL) // Add the user's profile picture
        .addFields({ name: 'Books Read', value: userData.count.toString(), inline: true })
        .addFields({ name: 'Leaderboard Position', value: `#${leaderboardPosition}`, inline: true })
        .addFields({ name: 'Reading Streak', value: streakDays ? `${streakDays} days` : 'No streak yet!', inline: true })
        .addFields({ name: 'Highest Streak', value: highestStreakDays ? `${highestStreakDays} days` : 'No streak yet!', inline: true })
        .addFields({ name: 'Favorite Books', value: profile?.favoriteBooks?.length > 0 ? profile.favoriteBooks.join('\n') : 'No favorites yet!' })
        .addFields({ name: 'Achievements', value: achievements ? Object.entries(achievements).filter(([_, value]) => value).map(([key]) => key).join('\n') || 'No achievements yet!' : 'No achievements yet!' })
        .setFooter({ text: 'Keep reading to grow your profile! 📚' });

      interaction.reply({ embeds: [embed] });
    }

    // Set bio command
    else if (commandName === 'setbio') {
      const bio = options.getString('bio');
      if (!bio) {
        return interaction.reply('Please provide a bio!');
      }

      let profile = database.loadUserProfile(userId);
      if (!profile) {
        profile = { userId, favoriteBooks: [], bio: '', profileColor: '#800080' };
      }

      profile.bio = bio;
      database.saveUserProfile(userId, profile.favoriteBooks, profile.bio, profile.profileColor);

      interaction.reply('Your bio has been updated!');
    }

    // Set profile color command
    else if (commandName === 'setcolor') {
      const color = options.getString('color');
      if (!color || !/^#[0-9A-F]{6}$/i.test(color)) {
        return interaction.reply('Please provide a valid hex color (e.g., #800080)!');
      }

      let profile = database.loadUserProfile(userId);
      if (!profile) {
        profile = { userId, favoriteBooks: [], bio: '', profileColor: '#800080' };
      }

      profile.profileColor = color;
      database.saveUserProfile(userId, profile.favoriteBooks, profile.bio, profile.profileColor);

      interaction.reply(`Your profile color has been updated to ${color}!`);
    }

    // Set favorite books command
    else if (commandName === 'favorite') {
      const bookName = options.getString('title');
      if (!bookName) {
        return interaction.reply('Please provide a book name to add to your favorites!');
      }

      const userData = database.loadUserBooks(userId);

      // Check if the book is in the user's read list
      if (!userData || !userData.books.includes(bookName)) {
        return interaction.reply(`"${bookName}" is not in your read list!`);
      }

      // Load or create user profile
      let profile = database.loadUserProfile(userId);
      if (!profile) {
        profile = { userId, favoriteBooks: [], bio: '', profileColor: '#800080' };
      }

      // Add or remove book from favorites
      if (profile.favoriteBooks.includes(bookName)) {
        profile.favoriteBooks = profile.favoriteBooks.filter(b => b !== bookName);
        interaction.reply(`Removed "${bookName}" from your favorites!`);
      } else {
        profile.favoriteBooks.push(bookName);
        interaction.reply(`Added "${bookName}" to your favorites!`);
      }

      // Save profile
      database.saveUserProfile(userId, profile.favoriteBooks, profile.bio, profile.profileColor);
    }

    // Help command
    else if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setColor('#800080') // Purple color
        .setTitle('Available Commands')
        .setDescription(`
          - **/addbook**: Add a book to your list.
          - **/bookcount**: Check how many books you've read.
          - **/recommend**: Get a book recommendation.
          - **/listbooks**: List all books you've read.
          - **/removebook**: Remove a book from your list.
          - **/setgoal**: Set a reading goal.
          - **/progress**: Check your progress toward your goal.
          - **/challenge**: Start a reading challenge.
          - **/streak**: Check your reading streak.
          - **/streakadd**: Log your daily reading to maintain your streak.
          - **/leaderboard**: See the top readers.
          - **/bookclub create**: Create a book club.
          - **/achievements**: View your achievements.
          - **/points**: Check your points.
          - **/funfact**: Get a fun fact about books.
          - **/quote**: Get a quote from a famous book.
          - **/mood**: Get a book recommendation based on your mood.
          - **/profile**: View your reading profile.
          - **/setbio**: Set your profile bio.
          - **/setcolor**: Set your profile color.
          - **/favorite**: Add or remove a book from your favorites.
        `)
        .setFooter({ text: 'Happy reading! 📚' });

      interaction.reply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error processing command:', error);
    interaction.reply({ content: 'An error occurred while processing your command.', ephemeral: true });
  }
});

// Start the bot
client.login(process.env.TOKEN); // Use the token from environment variables

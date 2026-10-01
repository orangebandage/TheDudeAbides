// Sample shelves for tools/preview.js.

const book = (id, title, author, hue) => ({ id: String(id), title, author, hue });

const sampleBooks = {
  reading: [
    book(1, "Fourth Wing (The Empyrean, #1)", "Rebecca Yarros", 28),
    book(2, "Tomorrow, and Tomorrow, and Tomorrow", "Gabrielle Zevin", 200),
  ],
  favorites: [
    book(10, "Pride and Prejudice", "Jane Austen", 345),
    book(11, "The Night Circus", "Erin Morgenstern", 0),
    book(12, "Jane Eyre", "Charlotte Brontë", 150),
    book(13, "Circe", "Madeline Miller", 38),
    book(14, "The Hobbit, or There and Back Again", "J.R.R. Tolkien", 120),
    book(15, "Little Women", "Louisa May Alcott", 220),
    book(16, "Rebecca", "Daphne du Maurier", 280),
    book(17, "The Secret History", "Donna Tartt", 5),
    book(18, "Emma", "Jane Austen", 190),
    book(19, "Beauty: A Retelling of the Story of Beauty and the Beast", "Robin McKinley", 330),
    book(20, "Wuthering Heights", "Emily Brontë", 160),
    book(21, "Dune", "Frank Herbert", 30),
  ],
};

module.exports = { sampleBooks };

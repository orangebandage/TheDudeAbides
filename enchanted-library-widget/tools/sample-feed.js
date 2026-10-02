// Sample shelves for tools/preview.js.

const book = (id, title, author, hue) => ({ id: String(id), title, author, hue });

const sampleBooks = {
  reading: [
    book(33131867, "The Risk (Mindf*ck, #1)", "S.T. Abby", 355),
  ],
  read: [
    book("r1", "Love, Theoretically", "Ali Hazelwood", 40),
    book("r2", "Book Lovers", "Emily Henry", 195),
    book("r3", "People We Meet on Vacation", "Emily Henry", 20),
    book("r4", "Comedy Sex God", "Pete Holmes", 5),
    book("r5", "This Summer Will Be Different", "Carley Fortune", 25),
    book("r6", "I Will Kill Your Imaginary Friend for $200", "Robert Brockway", 45),
    book("r7", "Great Big Beautiful Life", "Emily Henry", 10),
    book("r8", "Harvest Season (The Seasons of Carnage Trilogy, #2)", "Brynne Weaver", 340),
    book("r9", "11/22/63", "Stephen King", 0),
    book("r10", "How to Be Okay When Nothing Is Okay", "Jenny Lawson", 200),
    book("r11", "Game On (Into Darkness, #3)", "Navessa Allen", 120),
    book("r12", "Empire of Storms (Throne of Glass, #5)", "Sarah J. Maas", 290),
    book("r13", "I'd Like to Play Alone, Please: Essays", "Tom Segura", 100),
  ],
  // Placeholder to-read shelf.
  toRead: [
    book("t1", "Fourth Wing (The Empyrean, #1)", "Rebecca Yarros", 28),
    book("t2", "Funny Story", "Emily Henry", 50),
    book("t3", "Twisted Love (Twisted, #1)", "Ana Huang", 210),
    book("t4", "Iron Flame (The Empyrean, #2)", "Rebecca Yarros", 35),
    book("t5", "A Court of Thorns and Roses", "Sarah J. Maas", 0),
    book("t6", "Heart the Lover", "Lily King", 25),
    book("t7", "The Housemaid", "Freida McFadden", 230),
    book("t8", "Haunting Adeline", "H.D. Carlton", 260),
  ],
};

module.exports = { sampleBooks };

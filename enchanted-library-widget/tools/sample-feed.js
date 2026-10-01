// Stand-in for Goodreads' shelf RSS (same element names and CDATA wrapping).

const SHELVES = {
  "currently-reading": [
    ["Fourth Wing (The Empyrean, #1)", "Rebecca Yarros"],
    ["Tomorrow, and Tomorrow, and Tomorrow", "Gabrielle Zevin"],
  ],
  favorites: [
    ["Pride and Prejudice", "Jane Austen"],
    ["The Night Circus", "Erin Morgenstern"],
    ["Jane Eyre", "Charlotte Brontë"],
    ["Circe", "Madeline Miller"],
    ["The Hobbit, or There and Back Again", "J.R.R. Tolkien"],
    ["Little Women", "Louisa May Alcott"],
    ["Rebecca", "Daphne du Maurier"],
    ["The Secret History", "Donna Tartt"],
    ["Emma", "Jane Austen"],
    ["Beauty: A Retelling of the Story of Beauty and the Beast", "Robin McKinley"],
    ["Wuthering Heights", "Emily Brontë"],
    ["Dune", "Frank Herbert"],
  ],
};

function sampleFeed(shelf) {
  const books = SHELVES[shelf] || [];
  const items = books.map(([title, author], i) => `
    <item>
      <guid><![CDATA[https://www.goodreads.com/review/show/${1000 + i}]]></guid>
      <pubDate><![CDATA[Mon, 1 Sep 2025 10:00:00 -0700]]></pubDate>
      <title>${title.replace(/&/g, "&amp;")}</title>
      <link><![CDATA[https://www.goodreads.com/review/show/${1000 + i}]]></link>
      <book_id>${shelf.length * 100 + i}</book_id>
      <book_image_url><![CDATA[https://i.gr-assets.com/books/${i}._SY75_.jpg?title=${encodeURIComponent(title.split(" (")[0])}]]></book_image_url>
      <book_large_image_url><![CDATA[https://i.gr-assets.com/books/${i}._SY475_.jpg?title=${encodeURIComponent(title.split(" (")[0])}]]></book_large_image_url>
      <author_name>${author}</author_name>
      <user_date_added><![CDATA[${new Date(Date.UTC(2025, 8, 30 - i)).toUTCString()}]]></user_date_added>
    </item>`).join("");
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Shelf</title>${items}</channel></rss>`;
}

module.exports = { sampleFeed };

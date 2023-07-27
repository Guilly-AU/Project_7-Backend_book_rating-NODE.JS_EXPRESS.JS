const { error } = require("console");
const Book = require("../models/Book");
const fs = require("fs");

exports.createBook = (req, res, next) => {
  const bookObject = JSON.parse(req.body.book);
  delete bookObject._id;
  delete bookObject._userId;
  const book = new Book({
    ...bookObject,
    userId: req.auth.userId,
    imageUrl: `${req.protocol}://${req.get("host")}/images/${
      req.file.filename.split(".")[0]
    }.webp`,
  });

  book
    .save()
    .then(() => {
      res.status(201).json({ message: "Livre enregistré !" });
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
};

exports.modifyBook = (req, res, next) => {
  const bookObject = req.file
    ? {
        ...JSON.parse(req.body.book),
        imageUrl: `${req.protocol}://${req.get("host")}/images/${
          req.file.filename.split(".")[0]
        }.webp`,
      }
    : { ...req.body };
  delete bookObject._userId;
  Book.findOne({ _id: req.params.id })
    .then((book) => {
      if (book.userId != req.auth.userId) {
        res.status(401).json({ message: "Not authorized" });
      } else if (req.file) {
        const filename = book.imageUrl.split("/images")[1];
        fs.unlink(`images/${filename}`, () => {});
      }
      Book.updateOne(
        { _id: req.params.id },
        { ...bookObject, _id: req.params.id }
      )
        .then(() => res.status(200).json({ message: "Livre modifié!" }))
        .catch((error) => res.status(401).json({ error }));
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
};

exports.deleteBook = (req, res, next) => {
  Book.findOne({ _id: req.params.id })
    .then((book) => {
      if (book.userId != req.auth.userId) {
        res.status(401).json({ message: "Not authorized" });
      } else {
        const filename = book.imageUrl.split("/images/")[1];
        fs.unlink(`images/${filename}`, () => {
          Book.deleteOne({ _id: req.params.id })
            .then(() => {
              res.status(200).json({ message: "Livre supprimé !" });
            })
            .catch((error) => res.status(401).json({ error }));
        });
      }
    })
    .catch((error) => {
      res.status(500).json({ error });
    });
};

exports.findOneBook = (req, res, next) => {
  Book.findOne({ _id: req.params.id })
    .then((book) => res.status(200).json(book))
    .catch((error) => res.status(404).json({ error }));
};

exports.getAllBooks = (req, res, next) => {
  Book.find()
    .then((books) => res.status(200).json(books))
    .catch((error) => res.status(400).json({ error }));
};

exports.getBestBooks = (req, res, next) => {
  Book.find()
    .sort({ averageRating: "descending" })
    .limit(3)
    .then((books) => res.status(200).json(books))
    .catch((error) => res.status(400).json({ error }));
};

exports.rateBook = (req, res, next) => {
  const user = req.body.userId;
  const userRating = req.body.rating;

  if (user !== req.auth.userId) {
    return res.status(401).json({ message: "Not authorized" });
  } else {
    Book.findOne({ _id: req.params.id })
      .then((book) => {
        if (userRating < 0 || userRating > 5) {
          return res
            .status(400)
            .json({ message: "La note doit être comprise entre 0 et 5!" });
        }
        if (book.ratings.find((rating) => rating.userId === user)) {
          return res.status(401).json({ message: "Book already rated!" });
        } else {
          const newRating = {
            userId: user,
            grade: userRating,
          };

          const sumRatings = book.ratings.reduce(
            (sum, rating) => sum + rating.grade,
            0
          );

          const updateAverageRating =
            (sumRatings + userRating) / (book.ratings.length + 1);

          Book.findOneAndUpdate(
            { _id: req.params.id, "ratings.userId": { $ne: user } },
            {
              $push: { ratings: newRating },
              averageRating: updateAverageRating.toFixed(2),
            },
            { new: true }
          )
            .then((updatedBook) => res.status(201).json(updatedBook))
            .catch((error) => res.status(401).json({ error }));
        }
      })
      .catch((error) => res.status(401).json({ error }));
  }
};
